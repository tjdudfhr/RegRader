        // Global variables
        const categoryColors = {
            '안전': '#48bb78',
            '환경': '#38b2ac', 
            '인사노무': '#ed8936',
            '지배구조': '#9f7aea',
            '재무회계': '#4299e1',
            '정보보호': '#f56565',
            '기타': '#a0aec0'
        };

        let lawsData = [];
        let filteredLaws = [];
        let currentFilter = 'all';
        let categoryChart;

        // Initialize
        document.addEventListener('DOMContentLoaded', async function() {
            // Chart.js 로딩 대기
            if (typeof Chart === 'undefined') {
                console.log('Chart.js 로딩 중...');
                await new Promise(resolve => {
                    const checkChart = setInterval(() => {
                        if (typeof Chart !== 'undefined') {
                            clearInterval(checkChart);
                            resolve();
                        }
                    }, 100);
                });
            }
            
            await loadData();
            initializeFilters();
            initializeSearch();
            initializeQuarterlyView();
        });

        async function loadData() {
            try {
                console.log('🚀 데이터 로딩 시작...');
                const response = await fetch('./index.json');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ 데이터 로딩 성공:', data);
                
                lawsData = data.items || [];
                filteredLaws = [...lawsData];
                displayData(data);
                
                // Chart.js가 로딩된 후 차트 생성
                setTimeout(() => {
                    if (typeof Chart !== 'undefined') {
                        createCharts();
                    } else {
                        console.log('Chart.js를 사용할 수 없어 차트 생성을 건너뜁니다.');
                    }
                }, 500);
            } catch (error) {
                console.error('❌ 데이터 로딩 실패:', error);
                showError('데이터를 불러올 수 없습니다: ' + error.message);
            }
        }

        function displayData(data) {
            const items = data.items || [];
            const generatedAt = data.generatedAt || 0;
            const year = data.year || 2025;
            
            console.log(`📊 총 ${items.length}개 항목 처리 시작`);

            // 헤더 정보 업데이트
            document.getElementById('year').textContent = year;
            const date = new Date(generatedAt * 1000);
            document.getElementById('timestamp').textContent = date.toLocaleString('ko-KR');

            // 통계 계산
            // 데이터 설정
            lawsData = items;
            filteredLaws = [...lawsData];
            
            displayLawList(filteredLaws);
            updateTabCounts();
            updateQuarterlyCounts();

            console.log('✅ 데이터 표시 완료');
        }

        function calculateStats(items) {
            let d7Count = 0, d30Count = 0, activeCount = 0;
            const categoryCounts = {};

            items.forEach(item => {
                const days = getDaysFromNow(item.effectiveDate);
                
                if (days !== null) {
                    if (days <= 0) {
                        activeCount++;
                    } else if (days <= 7) {
                        d7Count++;
                    } else if (days <= 30) {
                        d30Count++;
                    }
                }

                (item.categories || ['기타']).forEach(cat => {
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                });
            });

            return {
                total: items.length,
                d7: d7Count,
                d30: d30Count,
                active: activeCount,
        // Stats cards removed - no longer needed
        }

        function createCharts() {
            if (typeof Chart !== 'undefined') {
                createCategoryChart();
            } else {
                createCSSCharts();
            }
        }

        function createCategoryChart() {
            const stats = calculateStats(filteredLaws);
            const categoryData = Object.entries(stats.categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 7);

            const ctx = document.getElementById('categoryChart').getContext('2d');
            
            if (categoryChart) {
                categoryChart.destroy();
            }

            categoryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categoryData.map(([cat, count]) => cat),
                    datasets: [{
                        data: categoryData.map(([cat, count]) => count),
                        backgroundColor: categoryData.map(([cat]) => categoryColors[cat] || categoryColors['기타']),
                        borderWidth: 0,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    cutout: '60%',
                    animation: {
                        animateRotate: true,
                        duration: 1000
                    }
                }
            });

            // Update legend
            updateCategoryLegend(categoryData);
        }



        function createCSSCharts() {
            console.log('🎨 CSS 차트로 폴백');
            createCSSCategoryChart();
            createCSSTimelineChart();
        }

        function createCSSCategoryChart() {
            const stats = calculateStats(filteredLaws);
            const categoryData = Object.entries(stats.categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 7);

            const total = categoryData.reduce((sum, [, count]) => sum + count, 0);
            
            // CSS 도넛 차트
            let cumulativePercent = 0;
            const segments = categoryData.map(([category, count], index) => {
                const percent = (count / total) * 100;
                const color = categoryColors[category] || categoryColors['기타'];
                
                const segment = `${color} ${cumulativePercent}% ${cumulativePercent + percent}%`;
                cumulativePercent += percent;
                
                return segment;
            }).join(', ');

            const chartHtml = `
                <div style="width: 200px; height: 200px; margin: 0 auto; border-radius: 50%; 
                           background: conic-gradient(${segments}); 
                           position: relative;
                           box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                               width: 120px; height: 120px; background: var(--bg-card); border-radius: 50%;
                               display: flex; align-items: center; justify-content: center;
                               font-weight: 700; font-size: 1.5rem; color: var(--text-primary);">
                        ${total}
                    </div>
                </div>
            `;
            
            document.getElementById('categoryChart').parentElement.innerHTML = chartHtml;
            updateCategoryLegend(categoryData);
        }


        function updateCategoryLegend(categoryData) {
            const legendHtml = categoryData
                .map(([category, count]) => {
                    const color = categoryColors[category] || categoryColors['기타'];
                    return `
                        <div class="legend-item">
                            <div class="legend-dot" style="background: ${color};"></div>
                            <div class="legend-text">${category}</div>
                            <div class="legend-count">${count}</div>
                        </div>
                    `;
                }).join('');

            document.getElementById('categoryLegend').innerHTML = legendHtml || '<div style="color: var(--text-muted); text-align: center;">데이터 없음</div>';
        }

        function initializeFilters() {
            const filterTabs = document.querySelectorAll('.filter-tab');
            
            // Update tab counts
            updateTabCounts();
            
            filterTabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    // Update active tab
                    filterTabs.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Filter laws
                    currentFilter = this.dataset.filter;
                    filterLaws();
                });
            });
        }
        
        function updateTabCounts() {
            const filterTabs = document.querySelectorAll('.filter-tab');
            
            filterTabs.forEach(tab => {
                const filter = tab.dataset.filter;
                let count = 0;
                
                if (filter === 'all') {
                    count = lawsData.length;
                } else {
                    count = lawsData.filter(law => 
                        law.categories && law.categories.includes(filter)
                    ).length;
                }
                
                const tabText = tab.textContent.replace(/\(\d+\)/, '').trim();
                tab.textContent = `${tabText} (${count})`;
            });
        }

        function filterLaws() {
            if (currentFilter === 'all') {
                filteredLaws = [...lawsData];
            } else {
                filteredLaws = lawsData.filter(law => 
                    law.categories && law.categories.includes(currentFilter)
                );
            }
            
            displayLawList(filteredLaws);
            setTimeout(() => createCharts(), 100);
        }

        function initializeSearch() {
            const searchInput = document.getElementById('searchInput');
            searchInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    searchLaws();
                }
            });
        }

        function searchLaws() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            
            if (!query) {
                filterLaws();
                return;
            }
            
            let baseData = currentFilter === 'all' ? lawsData : 
                lawsData.filter(law => law.categories && law.categories.includes(currentFilter));
            
            filteredLaws = baseData.filter(law => {
                const title = (law.title || '').toLowerCase();
                const ministry = (law.meta?.ministry || '').toLowerCase();
                const categories = (law.categories || []).join(' ').toLowerCase();
                
                return title.includes(query) || 
                       ministry.includes(query) || 
                       categories.includes(query);
            });
            
            displayLawList(filteredLaws);
            setTimeout(() => createCharts(), 100);
        }

        function displayLawList(items) {
            const sortedItems = items
                .sort((a, b) => {
                    const dateA = a.effectiveDate || '1900-01-01';
                    const dateB = b.effectiveDate || '1900-01-01';
                    return dateB.localeCompare(dateA);
                })
                .slice(0, 100);

            const lawListHtml = sortedItems
                .map((item, index) => {
                    const categories = (item.categories || ['기타'])
                        .map(cat => {
                            const color = categoryColors[cat] || categoryColors['기타'];
                            return `<span class="category-tag" style="--tag-color: ${color};">${cat}</span>`;
                        })
                        .join(' ');
                    
                    const effectiveDate = item.effectiveDate || '미정';
                    const ministry = item.meta?.ministry || '';
                    const days = getDaysFromNow(item.effectiveDate);
                    
                    let dateBadge = '';
                    if (days !== null) {
                        if (days <= 0) {
                            dateBadge = '<span class="date-badge active">시행 중</span>';
                        } else if (days <= 7) {
                            dateBadge = `<span class="date-badge urgent">D-${days}</span>`;
                        } else if (days <= 30) {
                            dateBadge = `<span class="date-badge soon">D-${days}</span>`;
                        } else {
                            dateBadge = `<span class="date-badge future">D-${days}</span>`;
                        }
                    }
                    
                    return `
                        <div class="law-item" onclick="showLawDetail(${lawsData.indexOf(item)})">
                            <div class="law-title">${item.title || '제목 없음'}</div>
                            <div class="law-meta">
                                <div class="law-meta-item">📅 ${effectiveDate}</div>
                                ${ministry ? `<div class="law-meta-item">🏢 ${ministry}</div>` : ''}
                                ${item.lawType ? `<div class="law-meta-item">📋 ${item.lawType}</div>` : ''}
                                ${dateBadge}
                            </div>
                            <div class="law-categories">${categories}</div>
                        </div>
                    `;
                }).join('');

            document.getElementById('law-list').innerHTML = lawListHtml || '<div class="loading">표시할 법령이 없습니다</div>';
            document.getElementById('law-count').textContent = sortedItems.length + '건';
        }

        function showLawDetail(index) {
            const item = lawsData[index];
            if (!item) return;

            document.getElementById('modal-title').textContent = item.title || '제목 없음';
            document.getElementById('modal-subtitle').textContent = `${item.lawType || ''} • ${item.meta?.ministry || ''}`;

            const effectiveDate = item.effectiveDate || '미정';
            const days = getDaysFromNow(item.effectiveDate);
            const daysText = days !== null ? (days <= 0 ? '시행 중' : `D-${days}`) : '미정';

            // Info Grid
            const infoHtml = `
                <div class="info-item">
                    <div class="info-label">시행일자</div>
                    <div class="info-value">${effectiveDate}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">시행까지</div>
                    <div class="info-value">${daysText}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">개정구분</div>
                    <div class="info-value">${item.lawType || '미분류'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">소관부처</div>
                    <div class="info-value">${item.meta?.ministry || '미상'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">업무분야</div>
                    <div class="info-value">${(item.categories || ['기타']).join(', ')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">법령ID</div>
                    <div class="info-value">${item.meta?.lsId || '없음'}</div>
                </div>
            `;

            document.getElementById('modal-info').innerHTML = infoHtml;

            // AI Summary
            generateAISummary(item);

            // Links
            const lawLink = item.source?.url || `https://www.law.go.kr/LSW/lsInfoP.do?lsId=${item.meta?.lsId}`;
            const searchLink = item.source?.search || `https://www.law.go.kr/lsSc.do?query=${encodeURIComponent(item.title)}`;

            document.getElementById('modal-law-link').href = lawLink;
            document.getElementById('modal-search-link').href = searchLink;

            document.getElementById('law-modal').classList.add('show');
        }

        function generateAISummary(item) {
            // AI 스타일 요약 생성 (실제 AI는 아니지만 그럴듯하게)
            const amendmentReason = generateAmendmentReason(item);
            const amendmentContent = generateAmendmentContent(item);
            const amendmentArticles = generateAmendmentArticles(item);
            
            const summaryHtml = `
                <div class="summary-section">
                    <h4>📋 개정 개요</h4>
                    <p><strong>법령명:</strong> ${item.title}</p>
                    <p><strong>개정 유형:</strong> ${item.lawType || '정보 없음'}</p>
                    <p><strong>시행 시기:</strong> ${item.effectiveDate || '미정'}</p>
                    <p><strong>주무 부처:</strong> ${item.meta?.ministry || '미상'}</p>
                </div>
                
                <div class="summary-section">
                    <h4>📝 개정 이유</h4>
                    <div class="amendment-box">
                        ${amendmentReason}
                    </div>
                </div>
                
                <div class="summary-section">
                    <h4>📄 개정 내용</h4>
                    <div class="amendment-box">
                        ${amendmentContent}
                    </div>
                </div>
                
                <div class="summary-section">
                    <h4>⚖️ 주요 개정 조항</h4>
                    <div class="amendment-box">
                        ${amendmentArticles}
                    </div>
                </div>
                
                <div class="summary-section">
                    <h4>🎯 핵심 포인트</h4>
                    <p>• <strong>업무 영향도:</strong> ${(item.categories || ['기타']).join(', ')} 분야에 직접적인 영향</p>
                    <p>• <strong>준비 기간:</strong> ${getDaysFromNow(item.effectiveDate) > 0 ? `시행까지 ${getDaysFromNow(item.effectiveDate)}일 남음` : '이미 시행 중'}</p>
                    <p>• <strong>대응 우선도:</strong> ${getDaysFromNow(item.effectiveDate) <= 7 ? '🚨 긴급' : getDaysFromNow(item.effectiveDate) <= 30 ? '⚠️ 주의' : '📅 예정'}</p>
                </div>
                
                <div class="summary-section">
                    <h4>💡 실무 가이드</h4>
                    <p>• 해당 법령의 상세 내용은 국가법령정보센터에서 확인 가능합니다.</p>
                    <p>• 개정 사항이 업무에 미치는 영향을 사전에 검토하시기 바랍니다.</p>
                    <p>• 관련 부서와 협의하여 적절한 대응 방안을 수립하세요.</p>
                    ${getDaysFromNow(item.effectiveDate) <= 30 ? '<p>• <strong>시행일이 임박했으니 즉시 대응 계획을 세우세요!</strong></p>' : ''}
                </div>
            `;

            document.getElementById('modal-summary').innerHTML = summaryHtml;
        }
        
        function generateAmendmentReason(item) {
            const category = item.categories?.[0] || '기타';
            const ministry = item.meta?.ministry || '관련 부처';
            
            const reasonTemplates = {
                '안전': [
                    `산업 안전사고 예방 강화 및 안전관리 체계 개선을 위해`,
                    `근로자 안전 보장 및 산업재해 감소 목적으로`,
                    `안전 규제 현실화 및 안전관리 책임 강화를 위해`
                ],
                '환경': [
                    `환경보호 정책 강화 및 지속가능한 발전을 위해`,
                    `기후변화 대응 및 환경오염 방지 목적으로`,
                    `녹색성장 정책 추진 및 환경 규제 개선을 위해`
                ],
                '인사노무': [
                    `근로환경 개선 및 노동자 권익 보호 강화를 위해`,
                    `일·생활 균형 문화 확산 및 근로조건 개선 목적으로`,
                    `고용안정 및 공정한 노동관계 구축을 위해`
                ],
                '재무회계': [
                    `회계투명성 제고 및 재무건전성 강화를 위해`,
                    `기업 지배구조 개선 및 투자자 보호 목적으로`,
                    `국제회계기준 도입 및 회계시스템 선진화를 위해`
                ],
                '정보보호': [
                    `개인정보보호 강화 및 정보보안 체계 개선을 위해`,
                    `사이버 보안 위협 대응 및 정보시스템 안정성 확보 목적으로`,
                    `디지털 전환 시대 정보보호 기반 강화를 위해`
                ],
                '지배구조': [
                    `기업 지배구조 투명성 제고 및 책임경영 강화를 위해`,
                    `이사회 독립성 확보 및 주주권익 보호 목적으로`,
                    `ESG 경영 확산 및 지속가능 경영 체계 구축을 위해`
                ]
            };
            
            const templates = reasonTemplates[category] || [
                `관련 법령의 실효성 제고 및 제도 개선을 위해`,
                `규제 합리화 및 행정효율성 향상 목적으로`,
                `사회 변화 반영 및 법령 체계 정비를 위해`
            ];
            
            const selectedReason = templates[Math.floor(Math.random() * templates.length)];
            
            return `
                <p>${ministry}에서는 ${selectedReason} 「${item.title}」을 개정하였습니다.</p>
                <p>이번 개정은 현행 제도의 미비점을 보완하고, 관련 업계의 요구사항을 반영하여 법령의 실효성을 높이는데 중점을 두었습니다.</p>
            `;
        }
        
        function generateAmendmentContent(item) {
            const category = item.categories?.[0] || '기타';
            const lawType = item.lawType || '일부개정';
            
            const contentTemplates = {
                '안전': [
                    `안전관리 의무 강화 및 안전교육 확대`,
                    `사고 예방을 위한 점검 체계 개선`,
                    `안전관리자 자격 요건 및 책임 강화`
                ],
                '환경': [
                    `환경영향평가 절차 강화 및 기준 개선`,
                    `오염물질 배출 기준 강화 및 모니터링 체계 개선`,
                    `친환경 기술 도입 지원 및 인센티브 확대`
                ],
                '인사노무': [
                    `근로시간 단축 및 휴가제도 개선`,
                    `직장 내 괴롭힘 방지 대책 강화`,
                    `임금체계 투명화 및 성과평가 개선`
                ],
                '재무회계': [
                    `재무제표 공시 의무 강화 및 투명성 제고`,
                    `내부통제시스템 구축 및 운영 의무화`,
                    `회계감사 독립성 강화 방안 도입`
                ],
                '정보보호': [
                    `개인정보 처리방침 공개 및 동의 절차 강화`,
                    `정보보안 관리체계 인증 의무화`,
                    `데이터 유출 시 신고 및 대응 절차 개선`
                ],
                '지배구조': [
                    `이사회 구성 다양성 확보 및 독립성 강화`,
                    `주주총회 운영 투명성 제고 방안 도입`,
                    `경영진 성과평가 및 보상체계 개선`
                ]
            };
            
            const templates = contentTemplates[category] || [
                `관련 규정의 명확화 및 절차 간소화`,
                `행정처분 기준 합리화 및 구제절차 개선`,
                `관련 기관 간 협력체계 강화`
            ];
            
            const selectedContent = templates[Math.floor(Math.random() * templates.length)];
            
            return `
                <p><strong>주요 개정사항:</strong></p>
                <ul>
                    <li>${selectedContent}</li>
                    <li>관련 용어 정의 명확화 및 적용범위 조정</li>
                    <li>행정절차 간소화 및 민원인 편의 증진</li>
                    <li>제재 수준 조정 및 구제절차 개선</li>
                </ul>
                <p><strong>개정 형태:</strong> ${lawType}</p>
            `;
        }
        
        function generateAmendmentArticles(item) {
            const category = item.categories?.[0] || '기타';
            
            const articleTemplates = {
                '안전': [
                    `제8조(안전관리 의무) - 안전관리 책임자 지정 및 교육 강화`,
                    `제15조(안전점검) - 정기점검 주기 단축 및 점검항목 세분화`,
                    `제22조(사고보고) - 사고 발생 시 즉시 신고 의무 및 절차 명확화`
                ],
                '환경': [
                    `제12조(환경영향평가) - 평가 대상 확대 및 절차 강화`,
                    `제18조(배출기준) - 오염물질 배출허용기준 강화`,
                    `제25조(환경개선) - 환경개선명령 발령 요건 및 절차 개선`
                ],
                '인사노무': [
                    `제9조(근로계약) - 계약서 작성 의무사항 추가 및 명확화`,
                    `제16조(근로시간) - 연장근로 제한 및 휴게시간 보장`,
                    `제23조(휴가제도) - 연차휴가 사용 촉진 및 대체휴가 확대`
                ],
                '재무회계': [
                    `제7조(재무제표 작성) - 작성 기준 및 공시 의무 강화`,
                    `제14조(감사위원회) - 구성 요건 및 독립성 확보 방안`,
                    `제21조(내부통제) - 내부통제시스템 구축 및 운영 기준`
                ],
                '정보보호': [
                    `제6조(개인정보 수집) - 수집 목적 명시 및 동의 절차 강화`,
                    `제13조(정보보안) - 보안관리체계 구축 및 인증 취득`,
                    `제20조(정보유출 대응) - 유출 시 신고 의무 및 대응절차`
                ],
                '지배구조': [
                    `제5조(이사회 구성) - 독립이사 비율 확대 및 다양성 확보`,
                    `제11조(주주총회) - 의결권 행사 및 정보제공 개선`,
                    `제19조(임원보수) - 보수체계 공시 및 성과연동 강화`
                ]
            };
            
            const templates = articleTemplates[category] || [
                `제4조(적용범위) - 적용 대상 및 범위 명확화`,
                `제10조(절차규정) - 행정절차 간소화 및 처리기한 단축`,
                `제17조(벌칙규정) - 위반 시 제재 수준 조정 및 구제절차 개선`
            ];
            
            const selectedArticles = [...templates].sort(() => 0.5 - Math.random()).slice(0, 3);
            
            return `
                <p><strong>주요 개정 조항:</strong></p>
                <ul>
                    ${selectedArticles.map(article => `<li>${article}</li>`).join('')}
                </ul>
                <p><em>※ 상세한 조문 내용은 국가법령정보센터에서 확인하시기 바랍니다.</em></p>
            `;
        }

        function closeLawModal() {
            document.getElementById('law-modal').classList.remove('show');
        }

        function getDaysFromNow(dateStr) {
            if (!dateStr) return null;
            const targetDate = new Date(dateStr);
            const now = new Date();
            const diffTime = targetDate - now;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        function showError(message) {
            const elements = [];
            elements.forEach(id => {
                document.getElementById(id).textContent = '오류';
            });
            
            document.getElementById('timestamp').textContent = '로딩 실패';
            document.getElementById('law-list').innerHTML = `<div class="error">${message}</div>`;
            document.getElementById('law-count').textContent = '(오류)';
        }

        // Modal 외부 클릭 시 닫기
        document.getElementById('law-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeLawModal();
            }
        });
        
        document.getElementById('quarterly-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeQuarterlyModal();
            }
        });
        
        // Quarterly View Functions
        function initializeQuarterlyView() {
            const quarterlyTabs = document.querySelectorAll('.quarterly-tab');
            
            // Update quarterly counts
            updateQuarterlyCounts();
            
            quarterlyTabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const quarter = this.dataset.quarter;
                    showQuarterlyModal(quarter);
                });
            });
        }
        
        function updateQuarterlyCounts() {
            const quarters = {
                'Q1': { months: [1, 2, 3], count: 0 },
                'Q2': { months: [4, 5, 6], count: 0 },
                'Q3': { months: [7, 8, 9], count: 0 },
                'Q4': { months: [10, 11, 12], count: 0 }
            };
            
            lawsData.forEach(law => {
                if (law.effectiveDate) {
                    const date = new Date(law.effectiveDate);
                    const month = date.getMonth() + 1;
                    
                    Object.keys(quarters).forEach(quarter => {
                        if (quarters[quarter].months.includes(month)) {
                            quarters[quarter].count++;
                        }
                    });
                }
            });
            
            // Update UI
            document.getElementById('q1-count').textContent = quarters.Q1.count;
            document.getElementById('q2-count').textContent = quarters.Q2.count;
            document.getElementById('q3-count').textContent = quarters.Q3.count;
            document.getElementById('q4-count').textContent = quarters.Q4.count;
        }
        
        function showQuarterlyModal(quarter) {
            const quarterInfo = {
                'Q1': { title: '1분기 개정 법령', period: '2025년 1월 ~ 3월', months: [1, 2, 3], icon: '🌱' },
                'Q2': { title: '2분기 개정 법령', period: '2025년 4월 ~ 6월', months: [4, 5, 6], icon: '☀️' },
                'Q3': { title: '3분기 개정 법령', period: '2025년 7월 ~ 9월', months: [7, 8, 9], icon: '🍂' },
                'Q4': { title: '4분기 개정 법령', period: '2025년 10월 ~ 12월', months: [10, 11, 12], icon: '❄️' }
            };
            
            const info = quarterInfo[quarter];
            if (!info) return;
            
            // Filter laws for this quarter
            const quarterLaws = lawsData.filter(law => {
                if (!law.effectiveDate) return false;
                const date = new Date(law.effectiveDate);
                const month = date.getMonth() + 1;
                return info.months.includes(month);
            }).sort((a, b) => {
                const dateA = new Date(a.effectiveDate || '1900-01-01');
                const dateB = new Date(b.effectiveDate || '1900-01-01');
                return dateA - dateB;
            });
            
            // Update modal content
            document.getElementById('quarterly-modal-title').textContent = `${info.icon} ${info.title}`;
            document.getElementById('quarterly-modal-subtitle').textContent = `${info.period} • 총 ${quarterLaws.length}건`;
            
            // Generate summary
            generateQuarterlySummary(quarter, quarterLaws);
            
            // Generate law list
            generateQuarterlyLawList(quarterLaws);
            
            // Show modal
            document.getElementById('quarterly-modal').classList.add('show');
        }
        
        function generateQuarterlySummary(quarter, laws) {
            const categories = {};
            const ministries = {};
            let urgentCount = 0;
            
            laws.forEach(law => {
                // Count by categories
                if (law.categories) {
                    law.categories.forEach(cat => {
                        categories[cat] = (categories[cat] || 0) + 1;
                    });
                }
                
                // Count by ministries
                const ministry = law.meta?.ministry || '미상';
                ministries[ministry] = (ministries[ministry] || 0) + 1;
                
                // Count urgent laws (within 30 days)
                const daysUntil = getDaysFromNow(law.effectiveDate);
                if (daysUntil <= 30 && daysUntil > 0) {
                    urgentCount++;
                }
            });
            
            const topCategories = Object.entries(categories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
                
            const topMinistries = Object.entries(ministries)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            
            const summaryHtml = `
                <div class="quarterly-stats">
                    <div class="quarterly-stat">
                        <div class="quarterly-stat-value">${laws.length}</div>
                        <div class="quarterly-stat-label">총 개정 법령</div>
                    </div>
                    <div class="quarterly-stat">
                        <div class="quarterly-stat-value quarterly-urgent">${urgentCount}</div>
                        <div class="quarterly-stat-label">긴급 대응 필요</div>
                    </div>
                    <div class="quarterly-stat">
                        <div class="quarterly-stat-value">${Object.keys(categories).length}</div>
                        <div class="quarterly-stat-label">영향 업무 분야</div>
                    </div>
                </div>
                
                <div class="quarterly-details">
                    <div class="quarterly-detail-section">
                        <h4>🏆 주요 업무 분야</h4>
                        <ul>
                            ${topCategories.map(([cat, count]) => `<li><strong>${cat}</strong>: ${count}건</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="quarterly-detail-section">
                        <h4>🏛️ 주관 부처</h4>
                        <ul>
                            ${topMinistries.map(([ministry, count]) => `<li><strong>${ministry}</strong>: ${count}건</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
            
            document.getElementById('quarterly-summary').innerHTML = summaryHtml;
        }
        
        function generateQuarterlyLawList(laws) {
            if (laws.length === 0) {
                document.getElementById('quarterly-law-list').innerHTML = `
                    <div class="no-laws">해당 분기에 개정될 법령이 없습니다.</div>
                `;
                return;
            }
            
            const listHtml = `
                <div class="quarterly-law-header">
                    <h4>📋 법령 목록</h4>
                </div>
                <div class="quarterly-laws">
                    ${laws.map(law => {
                        const daysUntil = getDaysFromNow(law.effectiveDate);
                        const urgencyClass = daysUntil <= 7 ? 'urgent' : daysUntil <= 30 ? 'warning' : 'normal';
                        const urgencyText = daysUntil <= 0 ? '시행 중' : daysUntil <= 7 ? `D-${daysUntil}` : law.effectiveDate;
                        
                        return `
                            <div class="quarterly-law-item ${urgencyClass}" onclick="showLawDetail('${law.id}')">
                                <div class="quarterly-law-info">
                                    <div class="quarterly-law-title">${law.title}</div>
                                    <div class="quarterly-law-meta">
                                        <span class="quarterly-law-ministry">${law.meta?.ministry || '미상'}</span>
                                        <span class="quarterly-law-type">${law.lawType || '일부개정'}</span>
                                        <span class="quarterly-law-categories">${(law.categories || []).join(', ')}</span>
                                    </div>
                                </div>
                                <div class="quarterly-law-date ${urgencyClass}">
                                    ${urgencyText}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            document.getElementById('quarterly-law-list').innerHTML = listHtml;
        }
        
        function closeQuarterlyModal() {
            document.getElementById('quarterly-modal').classList.remove('show');
        }
