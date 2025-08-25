// 브라우저 콘솔에서 실행할 분기탭 테스트 명령어들

// 1. Q1 분기탭 직접 클릭 테스트
console.log('=== Q1 분기탭 클릭 테스트 시작 ===');

// Q1 분기탭 요소 찾기
const q1Tab = document.querySelector('.quarterly-tab[onclick*="Q1"]');
if (q1Tab) {
    console.log('✅ Q1 분기탭 찾음:', q1Tab);
    
    // 클릭 이벤트 시뮬레이션
    q1Tab.click();
    console.log('🖱️ Q1 분기탭 클릭 완료');
    
    // quarterly-detail 요소 확인
    setTimeout(() => {
        const detailSection = document.getElementById('quarterly-detail');
        if (detailSection) {
            console.log('📋 quarterly-detail 요소 상태:');
            console.log('- display:', detailSection.style.display);
            console.log('- classList:', detailSection.classList.toString());
            console.log('- innerHTML 길이:', detailSection.innerHTML.length);
        } else {
            console.error('❌ quarterly-detail 요소를 찾을 수 없습니다');
        }
    }, 1000);
    
} else {
    console.error('❌ Q1 분기탭을 찾을 수 없습니다');
    
    // 모든 quarterly-tab 요소 확인
    const allTabs = document.querySelectorAll('.quarterly-tab');
    console.log('📋 전체 quarterly-tab 요소 수:', allTabs.length);
    allTabs.forEach((tab, index) => {
        console.log(`Tab ${index}:`, {
            onclick: tab.getAttribute('onclick'),
            textContent: tab.textContent.trim()
        });
    });
}

// 2. showQuarterlyDetail 함수 직접 호출 테스트
console.log('\n=== showQuarterlyDetail 함수 직접 호출 테스트 ===');
if (typeof showQuarterlyDetail === 'function') {
    console.log('✅ showQuarterlyDetail 함수 존재');
    
    // Q1 호출
    setTimeout(() => {
        console.log('📞 showQuarterlyDetail("Q1") 직접 호출...');
        showQuarterlyDetail('Q1');
    }, 2000);
    
} else {
    console.error('❌ showQuarterlyDetail 함수를 찾을 수 없습니다');
    console.log('사용 가능한 함수들:', Object.keys(window).filter(key => typeof window[key] === 'function' && key.includes('quarterly')));
}

// 3. DOM 요소들 확인
console.log('\n=== DOM 요소 확인 ===');
const detailSection = document.getElementById('quarterly-detail');
const contentDiv = detailSection?.querySelector('.quarterly-detail-content');

console.log('quarterly-detail 요소:', detailSection ? '✅ 존재' : '❌ 없음');
console.log('quarterly-detail-content 요소:', contentDiv ? '✅ 존재' : '❌ 없음');

if (detailSection) {
    console.log('quarterly-detail CSS 클래스:', detailSection.className);
    console.log('quarterly-detail 스타일:', {
        display: detailSection.style.display,
        maxHeight: getComputedStyle(detailSection).maxHeight,
        opacity: getComputedStyle(detailSection).opacity
    });
}