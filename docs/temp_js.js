        // 전역 변수
        let recipients = [];
        let selectedTemplate = 'all';
        let lawsData = [];
        
        // 페이지 로드 시 초기화
        window.onload = function() {
            loadSavedEmails();
            loadLawsData();
        };
        
        // 법령 데이터 로드
        function loadLawsData() {
            // 부모 창에서 데이터 가져오기
            if (window.opener && window.opener.lawsData) {
                lawsData = window.opener.lawsData;
                console.log('부모 창에서 데이터 로드:', lawsData.length, '건');
                return;
            }
            
            // 직접 로드
            fetch('index.json')
                .then(response => response.json())
                .then(data => {
                    // index.json 구조에 맞게 처리
                    if (data.items && Array.isArray(data.items)) {
                        lawsData = data.items;
                    } else if (Array.isArray(data)) {
                        lawsData = data;
                    } else {
                        lawsData = [];
                    }
                    console.log('데이터 로드 완료:', lawsData.length, '건');
                })
                .catch(error => {
                    console.error('데이터 로드 실패:', error);
                    showMessage('error', '데이터 로드에 실패했습니다.');
                });
        }
        
        // 저장된 이메일 불러오기
        function loadSavedEmails() {
            const saved = localStorage.getItem('regRaderEmails');
            if (saved) {
                const emails = JSON.parse(saved);
                const listEl = document.getElementById('savedList');
                listEl.innerHTML = emails.map(email => 
                    `<div class="saved-item" onclick="addSavedEmail('${email}')">${email}</div>`
                ).join('');
            }
        }
        
        // 저장된 이메일 추가
        function addSavedEmail(email) {
            if (!recipients.includes(email)) {
                recipients.push(email);
                updateEmailList();
            }
        }
        
        // 이메일 추가
        function addEmails() {
            const input = document.getElementById('emailInput');
            const emails = input.value.split(/[,;]/).map(e => e.trim()).filter(e => e);
            
            emails.forEach(email => {
                if (validateEmail(email) && !recipients.includes(email)) {
                    recipients.push(email);
                    saveEmail(email);
                }
            });
            
            updateEmailList();
            input.value = '';
        }
        
        // 이메일 저장
        function saveEmail(email) {
            let saved = localStorage.getItem('regRaderEmails');
            saved = saved ? JSON.parse(saved) : [];
            if (!saved.includes(email)) {
                saved.push(email);
                localStorage.setItem('regRaderEmails', JSON.stringify(saved));
                loadSavedEmails();
            }
        }
        
        // 이메일 검증
        function validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }
        
        // 이메일 목록 업데이트
        function updateEmailList() {
            const listEl = document.getElementById('emailList');
            if (recipients.length === 0) {
                listEl.innerHTML = '<div class="empty-message">이메일 주소를 추가해주세요</div>';
            } else {
                listEl.innerHTML = recipients.map((email, idx) => 
                    `<div class="email-tag">
                        ${email}
                        <span class="remove" onclick="removeEmail(${idx})">×</span>
                    </div>`
                ).join('');
            }
        }
        
        // 이메일 제거
        function removeEmail(index) {
            recipients.splice(index, 1);
            updateEmailList();
        }
        
        // 템플릿 선택
        function selectTemplate(template, element) {
            selectedTemplate = template;
            document.querySelectorAll('.template-card').forEach(card => {
                card.classList.remove('selected');
            });
            element.classList.add('selected');
        }
        
        // 이메일 발송
        async function sendEmails() {
            if (recipients.length === 0) {
                showMessage('error', '수신자를 추가해주세요.');
                return;
            }
            
            if (!lawsData || lawsData.length === 0) {
                showMessage('error', '데이터가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            
            const progressSection = document.getElementById('progressSection');
            const progressFill = document.getElementById('progressFill');
            const statusText = document.getElementById('statusText');
            
            progressSection.classList.add('active');
            let successCount = 0;
            let failCount = 0;
            
            for (let i = 0; i < recipients.length; i++) {
                const email = recipients[i];
                const progress = Math.round(((i + 1) / recipients.length) * 100);
                
                progressFill.style.width = progress + '%';
                progressFill.textContent = progress + '%';
                statusText.textContent = `${email}로 발송 중... (${i + 1}/${recipients.length})`;
                
                try {
                    await sendSingleEmail(email);
                    successCount++;
                    console.log(`✅ ${email} 발송 성공`);
                } catch (error) {
                    failCount++;
                    console.error(`❌ ${email} 발송 실패:`, error);
                }
                
                // 1초 대기 (EmailJS 제한)
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            progressSection.classList.remove('active');
            
            const resultMsg = `발송 완료! 성공: ${successCount}명, 실패: ${failCount}명`;
            showMessage(failCount === 0 ? 'success' : 'info', resultMsg);
        }
        
        // 개별 이메일 발송 (index.html과 동일한 로직)
        function sendSingleEmail(toEmail) {
            return new Promise((resolve, reject) => {
                let templateParams = {};
                
                if (selectedTemplate === 'all') {
                    // 전체 현황
                    const q1Count = lawsData.filter(law => {
                        if (!law.effectiveDate) return false;
                        const month = new Date(law.effectiveDate).getMonth() + 1;
                        return month >= 1 && month <= 3;
                    }).length;
                    
                    const q2Count = lawsData.filter(law => {
                        if (!law.effectiveDate) return false;
                        const month = new Date(law.effectiveDate).getMonth() + 1;
                        return month >= 4 && month <= 6;
                    }).length;
                    
                    const q3Count = lawsData.filter(law => {
                        if (!law.effectiveDate) return false;
                        const month = new Date(law.effectiveDate).getMonth() + 1;
                        return month >= 7 && month <= 9;
                    }).length;
                    
                    const q4Count = lawsData.filter(law => {
                        if (!law.effectiveDate) return false;
                        const month = new Date(law.effectiveDate).getMonth() + 1;
                        return month >= 10 && month <= 12;
                    }).length;
                    
                    const jobCategories = {};
                    lawsData.forEach(law => {
                        const category = (law.categories && law.categories[0]) || '기타';
                        jobCategories[category] = (jobCategories[category] || 0) + 1;
                    });
                    
                    const jobSummary = Object.entries(jobCategories)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, count]) => `${cat}: ${count}건`)
                        .join(' / ');
                    
                    // 직무별 상세 법령 목록 생성
                    const jobDetails = {};
                    lawsData.forEach(law => {
                        const category = (law.categories && law.categories[0]) || '기타';
                        if (!jobDetails[category]) {
                            jobDetails[category] = [];
                        }
                        jobDetails[category].push(law);
                    });
                    
                    // 카테고리 아이콘 매핑
                    const getCategoryIcon = (category) => {
                        const icons = {
                            '환경': '🌿',
                            '안전': '🛡️',
                            '재무회계': '💰',
                            '인사노무': '👥',
                            '정보보호': '🔒',
                            '공정거래': '⚖️',
                            '지배구조': '🏛️',
                            '지식재산권': '💡'
                        };
                        return icons[category] || '📋';
                    };
                    
                    // HTML 테이블 형식으로 직무별 상위 법령 목록 생성
                    let lawTableHTML = '';
                    Object.entries(jobDetails)
                        .sort((a, b) => b[1].length - a[1].length)
                        .slice(0, 3)  // 전체 현황은 상위 3개 직무만
                        .forEach(([category, laws]) => {
                            const icon = getCategoryIcon(category);
                            lawTableHTML += `<h3 style="color: #667eea; margin: 20px 0 10px;">${icon} ${category} (${laws.length}건)</h3>`;
                            lawTableHTML += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">';
                            lawTableHTML += '<tr style="background: #f8f9fa;"><th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">법령명</th><th style="padding: 10px; text-align: center; border: 1px solid #dee2e6; width: 120px;">시행일</th></tr>';
                            
                            laws.slice(0, 5).forEach(law => {
                                const date = law.effectiveDate ? new Date(law.effectiveDate).toLocaleDateString('ko-KR') : '날짜 미정';
                                lawTableHTML += `<tr><td style="padding: 10px; border: 1px solid #dee2e6;">${law.title}</td><td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${date}</td></tr>`;
                            });
                            
                            if (laws.length > 5) {
                                lawTableHTML += `<tr><td colspan="2" style="padding: 10px; text-align: center; border: 1px solid #dee2e6; color: #868e96;">... 외 ${laws.length - 5}건</td></tr>`;
                            }
                            lawTableHTML += '</table>';
                        });
                    
                    // 직무별 개수를 하나의 문자열로 만들기
                    const jobCounts = Object.entries(jobCategories)
                        .map(([category, count]) => `${category}:${count}`)
                        .join('|');
                    
                    // 월별 시행 예정 법령
                    const monthlyLaws = {};
                    lawsData.forEach(law => {
                        if (law.effectiveDate) {
                            const month = new Date(law.effectiveDate).getMonth() + 1;
                            if (!monthlyLaws[month]) {
                                monthlyLaws[month] = [];
                            }
                            monthlyLaws[month].push(law);
                        }
                    });
                    
                    const monthlySchedule = Object.entries(monthlyLaws)
                        .sort((a, b) => a[0] - b[0])
                        .map(([month, laws]) => `${month}월: ${laws.length}건`)
                        .join(', ');
                    
                    templateParams = {
                        to_email: toEmail,
                        email: toEmail,
                        name: toEmail.split('@')[0],
                        total: lawsData.length.toString(),
                        q1: q1Count.toString(),
                        q2: q2Count.toString(),
                        q3: q3Count.toString(),
                        q4: q4Count.toString(),
                        quarterly: `전체`,
                        job: jobSummary,
                        job_counts: jobCounts,  // 직무별 개수 문자열
                        laws: '최근 개정 법령',
                        title: `[RegRader] 2025년 전체 법령 현황 - ${lawsData.length}건`,
                        content: lawTableHTML,  // HTML 테이블 형식
                        url: 'https://tjdudfhr.github.io/RegRader/',
                        date: new Date().toLocaleDateString('ko-KR')
                    };

                } else {
                    // 분기별
                    const quarterNum = selectedTemplate.substring(1);
                    const quarterMonths = {
                        '1': [1, 2, 3],
                        '2': [4, 5, 6],
                        '3': [7, 8, 9],
                        '4': [10, 11, 12]
                    };
                    
                    const months = quarterMonths[quarterNum];
                    const quarterLaws = lawsData.filter(law => {
                        if (!law.effectiveDate) return false;
                        const month = new Date(law.effectiveDate).getMonth() + 1;
                        const year = new Date(law.effectiveDate).getFullYear();
                        return year === 2025 && months.includes(month);
                    });
                    
                    const jobCategories = {};
                    quarterLaws.forEach(law => {
                        const category = (law.categories && law.categories[0]) || '기타';
                        jobCategories[category] = (jobCategories[category] || 0) + 1;
                    });
                    
                    const jobSummary = Object.entries(jobCategories)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, count]) => `${cat}: ${count}건`)
                        .join(' / ');
                    
                    // 직무별 상세 법령 목록 생성 (HTML 형식)
                    const jobDetails = {};
                    quarterLaws.forEach(law => {
                        const category = (law.categories && law.categories[0]) || '기타';
                        if (!jobDetails[category]) {
                            jobDetails[category] = [];
                        }
                        jobDetails[category].push(law);
                    });
                    
                    // 카테고리 아이콘 매핑
                    const getCategoryIcon = (category) => {
                        const icons = {
                            '환경': '🌿',
                            '안전': '🛡️',
                            '재무회계': '💰',
                            '인사노무': '👥',
                            '정보보호': '🔒',
                            '공정거래': '⚖️',
                            '지배구조': '🏛️',
                            '지식재산권': '💡'
                        };
                        return icons[category] || '📋';
                    };
                    
                    // HTML 테이블 형식으로 직무별 법령 목록 생성
                    let lawTableHTML = '';
                    Object.entries(jobDetails)
                        .sort((a, b) => b[1].length - a[1].length)
                        .forEach(([category, laws]) => {
                            const icon = getCategoryIcon(category);
                            lawTableHTML += `<h3 style="color: #667eea; margin: 20px 0 10px;">${icon} ${category} (${laws.length}건)</h3>`;
                            lawTableHTML += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">';
                            lawTableHTML += '<tr style="background: #f8f9fa;"><th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">법령명</th><th style="padding: 10px; text-align: center; border: 1px solid #dee2e6; width: 120px;">시행일</th></tr>';
                            
                            laws.forEach(law => {
                                const date = law.effectiveDate ? new Date(law.effectiveDate).toLocaleDateString('ko-KR') : '날짜 미정';
                                lawTableHTML += `<tr><td style="padding: 10px; border: 1px solid #dee2e6;">${law.title}</td><td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${date}</td></tr>`;
                            });
                            lawTableHTML += '</table>';
                        });
                    
                    // 직무별 개수를 하나의 문자열로 만들기
                    const jobCounts = Object.entries(jobDetails)
                        .map(([category, laws]) => `${category}:${laws.length}`)
                        .join('|');
                    
                    // 월별 시행 일정
                    const monthlyBreakdown = {};
                    quarterLaws.forEach(law => {
                        if (law.effectiveDate) {
                            const month = new Date(law.effectiveDate).getMonth() + 1;
                            const monthName = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'][month - 1];
                            if (!monthlyBreakdown[monthName]) {
                                monthlyBreakdown[monthName] = 0;
                            }
                            monthlyBreakdown[monthName]++;
                        }
                    });
                    
                    const monthlySchedule = Object.entries(monthlyBreakdown)
                        .map(([month, count]) => `• ${month}: ${count}건`)
                        .join('\n');
                    
                    // 시행일 기준 정렬된 법령 목록 (상위 10개)
                    const sortedByDate = quarterLaws
                        .filter(law => law.effectiveDate)
                        .sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate))
                        .slice(0, 10)
                        .map((law, idx) => {
                            const date = new Date(law.effectiveDate).toLocaleDateString('ko-KR');
                            const category = (law.categories && law.categories[0]) || '기타';
                            return `${idx+1}. ${law.title}\n   [${category}] ${date} 시행`;
                        }).join('\n\n');
                    
                    // 분기 이름
                    const quarterNames = {
                        '1': '1분기 (1-3월)',
                        '2': '2분기 (4-6월)', 
                        '3': '3분기 (7-9월)',
                        '4': '4분기 (10-12월)'
                    };
                    
                    templateParams = {
                        to_email: toEmail,
                        email: toEmail,
                        name: toEmail.split('@')[0],
                        total: quarterLaws.length.toString(),
                        q1: selectedTemplate === 'q1' ? quarterLaws.length.toString() : '0',
                        q2: selectedTemplate === 'q2' ? quarterLaws.length.toString() : '0',
                        q3: selectedTemplate === 'q3' ? quarterLaws.length.toString() : '0',
                        q4: selectedTemplate === 'q4' ? quarterLaws.length.toString() : '0',
                        quarterly: `${quarterNum}분기`,
                        job: jobSummary || '데이터 없음',
                        job_counts: jobCounts,  // 직무별 개수 문자열
                        laws: sortedByDate || `${quarterNum}분기 법령`,
                        title: `[RegRader] 2025년 ${quarterNum}분기 법령 개정 안내 - ${quarterLaws.length}건`,
                        content: lawTableHTML,  // HTML 테이블 형식
                        url: 'https://tjdudfhr.github.io/RegRader/',
                        date: new Date().toLocaleDateString('ko-KR')
                    };
                }
                
                // EmailJS로 발송
                emailjs.send('service_7tdd8dh', 'template_tu71wgt', templateParams)
                    .then(function(response) {
                        console.log('SUCCESS!', response);
                        resolve(response);
                    })
                    .catch(function(error) {
                        console.error('FAILED...', error);
                        reject(error);
                    });
            });
        }
        
        // 테스트 이메일 발송
        function sendTestEmail() {
            const testEmail = prompt('테스트 이메일 주소:', 'test@example.com');
            if (testEmail && validateEmail(testEmail)) {
                showMessage('info', '테스트 이메일 발송 중...');
                sendSingleEmail(testEmail)
                    .then(() => showMessage('success', '테스트 이메일이 발송되었습니다!'))
                    .catch(error => showMessage('error', `발송 실패: ${error.text || error}`));
            }
        }
        
        // 메시지 표시
        function showMessage(type, text) {
            const messageEl = document.getElementById('message');
            messageEl.className = 'message ' + type;
            messageEl.textContent = text;
            messageEl.style.display = 'block';
            
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
