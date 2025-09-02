// EmailJS 백업 설정
// 메인 계정 한도 초과 시 사용할 백업 계정 정보

// 옵션 1: 새로운 EmailJS 계정 생성
// 1. https://www.emailjs.com 접속
// 2. 새 계정 가입 (다른 이메일 사용)
// 3. Email Service 추가 (Gmail 추천)
// 4. Email Template 생성
// 5. 아래 정보 업데이트

const EMAILJS_CONFIGS = {
    // 메인 계정
    main: {
        publicKey: "Nt6PrPKpsL1ruZEIH",
        serviceId: "service_7tdd8dh",
        templateId: "template_tu71wgt"
    },
    
    // 백업 계정 (새로 만들어야 함)
    backup: {
        publicKey: "YOUR_NEW_PUBLIC_KEY",
        serviceId: "YOUR_NEW_SERVICE_ID",
        templateId: "YOUR_NEW_TEMPLATE_ID"
    }
};

// 사용 예시:
// emailjs.init(EMAILJS_CONFIGS.backup.publicKey);
// emailjs.send(EMAILJS_CONFIGS.backup.serviceId, EMAILJS_CONFIGS.backup.templateId, templateParams);