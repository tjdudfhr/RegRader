// 법규 자동 매핑 시스템
// 적용법규 추가시 2025년 전체 법규와 자동 매칭하여 index.json 업데이트

class LawAutoMapper {
    constructor() {
        this.baseLaws = [];      // 기본 적용법규 (207개+)
        this.allLaws2025 = [];   // 2025년 전체 법규 (2,971개)
        this.matchedLaws = [];   // 매칭된 법규 (276개+)
        this.matchingRules = this.initMatchingRules();
    }

    // 매칭 규칙 초기화
    initMatchingRules() {
        return {
            // 정확한 일치
            exactMatch: (baseLaw, law2025) => {
                return this.normalizeTitle(baseLaw.title) === this.normalizeTitle(law2025.title);
            },
            // 부분 일치 (핵심 단어)
            partialMatch: (baseLaw, law2025) => {
                const baseKeywords = this.extractKeywords(baseLaw.title);
                const law2025Keywords = this.extractKeywords(law2025.title);
                const matchCount = baseKeywords.filter(keyword => 
                    law2025Keywords.includes(keyword)
                ).length;
                return matchCount >= Math.min(2, baseKeywords.length * 0.6);
            },
            // 법령 유형 일치
            typeMatch: (baseLaw, law2025) => {
                const baseType = this.extractLawType(baseLaw.title);
                const law2025Type = this.extractLawType(law2025.title);
                return baseType === law2025Type;
            }
        };
    }

    // 제목 정규화
    normalizeTitle(title) {
        return title
            .replace(/\s+/g, '')
            .replace(/[^\w가-힣]/g, '')
            .toLowerCase();
    }

    // 핵심 키워드 추출
    extractKeywords(title) {
        // 불용어 제거
        const stopwords = ['법', '령', '규칙', '규정', '시행', '에', '관한', '의', '및', '등'];
        const words = title.split(/[\s\-_]/).filter(word => 
            word.length > 1 && !stopwords.includes(word)
        );
        return words;
    }

    // 법령 유형 추출
    extractLawType(title) {
        if (title.includes('시행령')) return '시행령';
        if (title.includes('시행규칙')) return '시행규칙';
        if (title.includes('고시')) return '고시';
        if (title.includes('훈령')) return '훈령';
        if (title.includes('예규')) return '예규';
        if (title.includes('법') && !title.includes('시행')) return '법률';
        return '기타';
    }

    // 새로운 적용법규 추가
    async addNewBaseLaw(lawData) {
        console.log('🔍 새로운 적용법규 추가 시도:', lawData.title);
        
        // 1. 기본 적용법규에 추가
        const newBaseLaw = {
            id: `base_${Date.now()}`,
            title: lawData.title,
            categories: lawData.categories || [],
            ministry: lawData.ministry || '관계부처',
            addedDate: new Date().toISOString()
        };
        
        this.baseLaws.push(newBaseLaw);
        
        // 2. 2025년 법규와 자동 매칭
        const matches = await this.findMatches(newBaseLaw);
        
        // 3. 매칭 결과 처리
        if (matches.length > 0) {
            console.log(`✅ ${matches.length}개 매칭 발견`);
            
            // 가장 높은 점수의 매칭 선택
            const bestMatch = matches[0];
            
            // 새로운 매칭 법규 생성
            const newMatchedLaw = {
                id: `matched_${this.matchedLaws.length + 1}`,
                ...bestMatch.law,
                baseLawId: newBaseLaw.id,
                matchScore: bestMatch.score,
                matchedDate: new Date().toISOString()
            };
            
            this.matchedLaws.push(newMatchedLaw);
            
            // 4. index.json 업데이트
            await this.updateIndexJson(newMatchedLaw);
            
            // 5. 통계 업데이트
            this.updateStatistics();
            
            return {
                success: true,
                baseLaw: newBaseLaw,
                matchedLaw: newMatchedLaw,
                totalMatches: this.matchedLaws.length
            };
        } else {
            console.log('⚠️ 매칭되는 2025년 법규 없음');
            return {
                success: true,
                baseLaw: newBaseLaw,
                matchedLaw: null,
                totalMatches: this.matchedLaws.length
            };
        }
    }

    // 2025년 법규와 매칭 찾기
    async findMatches(baseLaw) {
        const matches = [];
        
        // 전체 2025년 법규 로드 (캐시 활용)
        if (this.allLaws2025.length === 0) {
            await this.load2025Laws();
        }
        
        for (const law2025 of this.allLaws2025) {
            let score = 0;
            
            // 정확한 일치 체크 (100점)
            if (this.matchingRules.exactMatch(baseLaw, law2025)) {
                score += 100;
            }
            
            // 부분 일치 체크 (50점)
            if (this.matchingRules.partialMatch(baseLaw, law2025)) {
                score += 50;
            }
            
            // 법령 유형 일치 체크 (20점)
            if (this.matchingRules.typeMatch(baseLaw, law2025)) {
                score += 20;
            }
            
            // 카테고리 일치 체크 (30점)
            if (this.checkCategoryMatch(baseLaw, law2025)) {
                score += 30;
            }
            
            if (score >= 50) {  // 최소 점수 threshold
                matches.push({
                    law: law2025,
                    score: score,
                    matchType: this.getMatchType(score)
                });
            }
        }
        
        // 점수순 정렬
        matches.sort((a, b) => b.score - a.score);
        return matches;
    }

    // 카테고리 매칭 체크
    checkCategoryMatch(baseLaw, law2025) {
        if (!baseLaw.categories || !law2025.categories) return false;
        return baseLaw.categories.some(cat => 
            law2025.categories.includes(cat)
        );
    }

    // 매칭 타입 결정
    getMatchType(score) {
        if (score >= 150) return 'exact';
        if (score >= 100) return 'high';
        if (score >= 70) return 'medium';
        return 'low';
    }

    // 2025년 전체 법규 로드
    async load2025Laws() {
        try {
            // 실제로는 API나 파일에서 로드
            const response = await fetch('/api/laws/2025/all');
            const data = await response.json();
            this.allLaws2025 = data.items || [];
            console.log(`📚 ${this.allLaws2025.length}개 2025년 법규 로드`);
        } catch (error) {
            console.error('2025년 법규 로드 실패:', error);
            // 더미 데이터 사용 (테스트용)
            this.allLaws2025 = this.generateDummy2025Laws();
        }
    }

    // index.json 업데이트
    async updateIndexJson(newLaw) {
        try {
            // 현재 index.json 로드
            const response = await fetch('./index.json');
            const data = await response.json();
            
            // 새로운 법규 추가
            data.items.push(newLaw);
            data.totalCount = data.items.length;
            
            // 저장 (실제로는 서버 API 호출)
            await this.saveIndexJson(data);
            
            // UI 업데이트 트리거
            if (window.updateAllCounts) {
                window.updateAllCounts();
            }
            
            console.log('✅ index.json 업데이트 완료');
        } catch (error) {
            console.error('index.json 업데이트 실패:', error);
        }
    }

    // 통계 업데이트
    updateStatistics() {
        const stats = {
            baseLaws: this.baseLaws.length,
            matchedLaws: this.matchedLaws.length,
            matchRate: ((this.matchedLaws.length / this.baseLaws.length) * 100).toFixed(1) + '%',
            timestamp: new Date().toISOString()
        };
        
        // localStorage에 저장
        localStorage.setItem('lawMappingStats', JSON.stringify(stats));
        
        // 이벤트 발생
        window.dispatchEvent(new CustomEvent('lawStatsUpdated', { detail: stats }));
        
        return stats;
    }

    // 더미 2025년 법규 생성 (테스트용)
    generateDummy2025Laws() {
        return [
            {
                title: "개인정보 보호법 시행령",
                effectiveDate: "2025-03-01",
                categories: ["정보보호"],
                ministry: "개인정보보호위원회"
            },
            {
                title: "근로기준법 시행규칙",
                effectiveDate: "2025-01-01",
                categories: ["인사노무"],
                ministry: "고용노동부"
            },
            {
                title: "환경영향평가법",
                effectiveDate: "2025-07-01",
                categories: ["환경"],
                ministry: "환경부"
            }
            // ... 더 많은 더미 데이터
        ];
    }

    // index.json 저장 (서버 API)
    async saveIndexJson(data) {
        // 실제로는 서버 API 호출
        // await fetch('/api/save-index', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(data)
        // });
        
        // 현재는 localStorage 사용
        localStorage.setItem('indexJson', JSON.stringify(data));
    }
}

// 전역 인스턴스 생성
window.lawAutoMapper = new LawAutoMapper();

// 초기화
console.log('✅ Law Auto Mapper 시스템 로드 완료');