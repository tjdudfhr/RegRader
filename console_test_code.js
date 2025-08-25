// 이 코드를 브라우저 콘솔에 붙여넣고 실행하세요

console.log('=== 분기탭 클릭 테스트 시작 ===');

// 1단계: Q1 버튼 찾기
const q1Button = document.querySelector('.quarterly-tab[onclick*="Q1"]');
console.log('Q1 버튼 찾음:', !!q1Button);

if (!q1Button) {
    console.error('❌ Q1 버튼을 찾을 수 없습니다!');
    const allTabs = document.querySelectorAll('.quarterly-tab');
    console.log('전체 quarterly-tab 개수:', allTabs.length);
    console.log('모든 탭들:', allTabs);
} else {
    console.log('✅ Q1 버튼 찾음:', q1Button);
    
    // 2단계: showQuarterlyDetail 함수 확인
    if (typeof showQuarterlyDetail !== 'function') {
        console.error('❌ showQuarterlyDetail 함수가 정의되지 않았습니다!');
    } else {
        console.log('✅ showQuarterlyDetail 함수 존재');
        
        // 3단계: quarterly-detail 요소 확인
        const detailSection = document.getElementById('quarterly-detail');
        if (!detailSection) {
            console.error('❌ quarterly-detail 요소가 없습니다!');
        } else {
            console.log('✅ quarterly-detail 요소 존재');
            
            // 4단계: 실제 함수 호출
            console.log('🚀 showQuarterlyDetail("Q1") 호출...');
            showQuarterlyDetail('Q1');
            
            // 5단계: 결과 확인 (3초 후)
            setTimeout(() => {
                console.log('=== 결과 확인 ===');
                console.log('quarterly-detail display:', detailSection.style.display);
                console.log('quarterly-detail classes:', detailSection.classList.toString());
                console.log('quarterly-detail computed display:', getComputedStyle(detailSection).display);
                console.log('quarterly-detail computed maxHeight:', getComputedStyle(detailSection).maxHeight);
                console.log('quarterly-detail computed opacity:', getComputedStyle(detailSection).opacity);
                
                if (detailSection.style.display === 'block' || detailSection.classList.contains('expanded')) {
                    console.log('✅ SUCCESS: 분기 슬라이드가 정상 작동합니다!');
                    alert('✅ 분기 슬라이드가 정상 작동합니다!');
                } else {
                    console.log('❌ FAILED: 슬라이드가 표시되지 않았습니다');
                    alert('❌ 슬라이드가 표시되지 않았습니다. 콘솔 로그를 확인해주세요.');
                }
            }, 3000);
        }
    }
}

// 추가: 직접 클릭도 시도
if (q1Button) {
    console.log('🖱️ 직접 클릭도 시도...');
    q1Button.click();
}