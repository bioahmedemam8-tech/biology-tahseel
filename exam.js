// نظام الاختبارات الذاتية ولوحة المعلم - منصة أ. أحمد إمام
(function() {
    const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwn0rjUKvXuow5P1D1TmZT7fUKX32BGXR1H1EInH9F0W81HA3zF980NqLHD71Jk5VaRSA/exec";

    let examQuestions = [];
    let currentExamIndex = 0;
    let userAnswers = [];
    let examTimer = null;
    let timeRemaining = 0;
    let studentInfo = { name: "", school: "" };
    let activeExamTitle = "اختبار تحصيلي ذاتي";
    let isTeacherExam = false;
    let selectedForExam = new Set();

    // قراءة رابط الاختبار المخصص إن وجد
    const urlParams = new URLSearchParams(window.location.search);
    const sharedExamData = urlParams.get('exam');

    // جلب العدد الفعلي للاختبارات المنجزة من Google Sheets
    async function syncExamCounterFromSheet() {
        try {
            const res = await fetch(GOOGLE_SHEET_URL);
            const data = await res.json();
            if (typeof data.count === 'number') {
                localStorage.setItem('bio_exam_count', data.count);
                const badge = document.getElementById('exam-counter-val');
                if (badge) badge.textContent = data.count;
            }
        } catch (err) {
            console.warn("تعذر تحديث العداد من السحابة، يتم عرض القيمة المحفوظة.", err);
        }
    }

    // إرسال نتيجة الطالب إلى Google Sheets
    async function sendResultToGoogleSheet(payload) {
        const statusEl = document.getElementById('sheet-sync-status');
        try {
            const res = await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data && data.status === 'success') {
                if (typeof data.count === 'number') {
                    localStorage.setItem('bio_exam_count', data.count);
                    const badge = document.getElementById('exam-counter-val');
                    if (badge) badge.textContent = data.count;
                }
                if (statusEl) {
                    statusEl.innerHTML = '✅ تم حفظ نتيجتك في سجل أ. أحمد إمام بنجاح';
                    statusEl.style.background = 'rgba(22, 163, 74, 0.25)';
                }
            }
        } catch (err) {
            console.error("خطأ في إرسال النتيجة إلى Google Sheets:", err);
            if (statusEl) {
                statusEl.innerHTML = '⚠️ تعذر الحفظ السحابي التلقائي (يرجى تصوير الشاشة)';
                statusEl.style.background = 'rgba(234, 179, 8, 0.25)';
            }
        }
    }

    // إنشاء واجهة الأزرار العلوية والعداد
    window.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('header');
        if (!header) return;

        // عداد الطلاب المختبرين
        const savedCount = parseInt(localStorage.getItem('bio_exam_count') || '0', 10);
        const bar = document.createElement('div');
        bar.id = 'exam-top-bar';
        bar.style.cssText = 'margin-top:15px; display:flex; flex-wrap:wrap; gap:10px; justify-content:center; align-items:center;';
        bar.innerHTML = `
            <span id="visitors-badge" style="background:rgba(255,255,255,0.2); padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:bold;">
                👥 عدد الاختبارات المُنجزة: <strong id="exam-counter-val">${savedCount}</strong>
            </span>
            <button onclick="openSelfExamSetup()" style="background:#f59e0b; color:#fff; border:none; padding:8px 18px; border-radius:20px; font-weight:bold; cursor:pointer; font-family:inherit; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
                📝 اختبر نفسك (اختبار بمؤقت)
            </button>
            <button onclick="openTeacherPanel()" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.3); padding:8px 16px; border-radius:20px; font-weight:bold; cursor:pointer; font-family:inherit;">
                🔐 لوحة المعلم (إنشاء اختبار)
            </button>
        `;
        header.appendChild(bar);

        // تحديث العداد الفعلي فور تحميل الصفحة
        syncExamCounterFromSheet();

        // إنشاء حاوية شاشة الاختبار المنبثقة
        const modal = document.createElement('div');
        modal.id = 'exam-overlay';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:#f8fafc; z-index:9999; overflow-y:auto; padding:20px; direction:rtl;';
        document.body.appendChild(modal);

        // إذا فتح الطالب رابط اختبار مرسل من المعلم
        if (sharedExamData) {
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedExamData))));
                isTeacherExam = true;
                activeExamTitle = decoded.t || "اختبار مقرر الأحياء";
                const mins = decoded.m || 15;
                const indices = decoded.q || [];
                setTimeout(() => {
                    examQuestions = indices.map(i => questionsBank[i]).filter(Boolean);
                    if (examQuestions.length > 0) {
                        showStudentLoginScreen(mins);
                    }
                }, 600);
            } catch (e) {
                console.error("خطأ في قراءة رابط الاختبار", e);
            }
        }
    });

    // شاشة إعداد الاختبار الذاتي للطالب
    window.openSelfExamSetup = function() {
        isTeacherExam = false;
        const modal = document.getElementById('exam-overlay');
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="max-width:550px; margin:30px auto; background:#fff; padding:2
