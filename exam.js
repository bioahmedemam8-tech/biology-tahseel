(function() {
    const TEACHER_PIN = "2026";
    const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwn0rjUKvXuow5P1D1TmZT7fUKX32BGXR1H1EInH9F0W81HA3zF980NqLHD71Jk5VaRSA/exec";
    const GOOGLE_DRIVE_SHEET_SEARCH = "https://docs.google.com/spreadsheets/u/0/";

    let examQuestions = [];
    let currentExamIndex = 0;
    let userAnswers = [];
    let examTimer = null;
    let timeRemaining = 0;
    let isUntimedExam = false;
    let studentInfo = { name: "", school: "" };
    let activeExamTitle = "اختبار تحصيلي ذاتي";
    let selectedForExam = new Set();
    let selfSelectedLessons = new Set();
    let lastWrongQuestions = [];
    let teacherSelectedLessons = new Set();
    let teacherCurrentFilteredIndices = [];
    let lastGeneratedUrl = "";

    const urlParams = new URLSearchParams(window.location.search);
    const sharedExamData = urlParams.get('exam');

    async function syncExamCounterFromSheet() {
        try {
            const res = await fetch(GOOGLE_SHEET_URL);
            const data = await res.json();
            if (typeof data.count === 'number') {
                localStorage.setItem('bio_exam_count', data.count);
                const badge = document.getElementById('exam-counter-val');
                if (badge) badge.textContent = data.count;
            }
        } catch (err) {}
    }

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
            if (statusEl) {
                statusEl.innerHTML = '⚠️ تعذر الحفظ السحابي التلقائي (يرجى تصوير الشاشة)';
                statusEl.style.background = 'rgba(234, 179, 8, 0.25)';
            }
        }
    }

    function initExamPlatform() {
        const header = document.querySelector('header');
        if (!header || document.getElementById('exam-top-bar')) return;

        const savedCount = parseInt(localStorage.getItem('bio_exam_count') || '0', 10);
        const bar = document.createElement('div');
        bar.id = 'exam-top-bar';
        bar.style.cssText = 'margin-top:15px; display:flex; flex-wrap:wrap; gap:10px; justify-content:center; align-items:center;';
        bar.innerHTML = `
            <span id="visitors-badge" style="background:rgba(255,255,255,0.2); padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:bold;">
                👥 عدد الاختبارات المُنجزة: <strong id="exam-counter-val">${savedCount}</strong>
            </span>
            <button onclick="openSelfExamSetup()" style="background:#f59e0b; color:#fff; border:none; padding:8px 18px; border-radius:20px; font-weight:bold; cursor:pointer; font-family:inherit; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
                📝 اختبر نفسك (اختبار ذاتي)
            </button>
            <button onclick="openTeacherPanel()" style="background:#1e293b; color:#fff; border:1px solid rgba(255,255,255,0.3); padding:8px 16px; border-radius:20px; font-weight:bold; cursor:pointer; font-family:inherit;">
                🔐 لوحة المعلم (إنشاء اختبار)
            </button>
        `;
        header.appendChild(bar);
        syncExamCounterFromSheet();

        const modal = document.createElement('div');
        modal.id = 'exam-overlay';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:#f8fafc; z-index:9999; overflow-y:auto; padding:20px; direction:rtl;';
        document.body.appendChild(modal);

        if (sharedExamData) {
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedExamData))));
                activeExamTitle = decoded.t || "اختبار مقرر الأحياء";
                const mins = decoded.m !== undefined ? decoded.m : 15;
                const indices = decoded.q || [];
                setTimeout(() => {
                    examQuestions = indices.map(i => questionsBank[i]).filter(Boolean);
                    if (examQuestions.length > 0) showStudentLoginScreen(mins);
                }, 600);
            } catch (e) {}
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initExamPlatform);
    } else {
        initExamPlatform();
    }

    window.openSelfExamSetup = function() {
        selfSelectedLessons.clear();
        const modal = document.getElementById('exam-overlay');
        modal.style.display = 'block';
        const subjects = [...new Set(questionsBank.map(q => q.subject))];
        const subjOptions = subjects.map(s => `<option value="${s}">${s}</option>`).join('');

        modal.innerHTML = `
            <div style="max-width:600px; margin:25px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                    <h2 style="margin:0; color:#0f766e;">📝 إعداد اختبار تحصيلي ذاتي</h2>
                    <button onclick="closeExamOverlay()" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">إغلاق ✖</button>
                </div>
                <label style="display:block; font-weight:bold; margin-bottom:6px;">اسم الطالب الثلاثي (مطلوب):</label>
                <input id="stu-name" type="text" placeholder="اكتب اسمك الثلاثي هنا..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:12px; font-family:inherit;">
                <label style="display:block; font-weight:bold; margin-bottom:6px;">المدرسة أو الفصل (اختياري):</label>
                <input id="stu-school" type="text" placeholder="مثال: ثانوية أضواء البيان..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:12px; font-family:inherit;">
                <label style="display:block; font-weight:bold; margin-bottom:6px;">1️⃣ اختر المقرر:</label>
                <select id="self-subject" onchange="onSelfSubjectChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:12px; font-family:inherit;">
                    <option value="all">شامل جميع المقررات</option>
                    ${subjOptions}
                </select>
                <div id="self-lessons-wrapper" style="display:none; margin-bottom:14px; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:10px;">
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#0f766e; font-size:0.9rem;">2️⃣ حدد درساً أو أكثر (أو اتركها فارغة لاختبار شامل للمقرر):</label>
                    <div id="self-lessons-box" style="display:flex; flex-wrap:wrap; gap:6px; max-height:130px; overflow-y:auto;"></div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                    <div>
                        <label style="display:block; font-weight:bold; margin-bottom:6px; font-size:0.9rem;">3️⃣ عدد الأسئلة (المتاح: <span id="self-avail-count">${questionsBank.length}</span>):</label>
                        <select id="self-count" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;">
                            <option value="5">5 أسئلة</option>
                            <option value="10" selected>10 أسئلة</option>
                            <option value="15">15 سؤالاً</option>
                            <option value="20">20 سؤالاً</option>
                            <option value="30">30 سؤالاً</option>
                            <option value="50">50 سؤالاً</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-weight:bold; margin-bottom:6px; font-size:0.9rem;">4️⃣ مدة الاختبار:</label>
                        <select id="self-time" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;">
                            <option value="0">مفتوح (بدون مؤقت)</option>
                            <option value="5">5 دقائق</option>
                            <option value="10" selected>10 دقائق</option>
                            <option value="15">15 دقيقة</option>
                            <option value="20">20 دقيقة</option>
                            <option value="30">30 دقيقة</option>
                            <option value="45">45 دقيقة</option>
                            <option value="60">60 دقيقة</option>
                        </select>
                    </div>
                </div>
                <button onclick="startSelfExam()" style="width:100%; background:#0f766e; color:#fff; border:none; padding:12px; border-radius:10px; font-size:1.05rem; font-weight:bold; cursor:pointer; font-family:inherit;">🚀 ابدأ الاختبار الآن</button>
            </div>
        `;
    };

    window.onSelfSubjectChange = function() {
        const subj = document.getElementById('self-subject').value;
        selfSelectedLessons.clear();
        const wrapper = document.getElementById('self-lessons-wrapper');
        const box = document.getElementById('self-lessons-box');
        if (subj === 'all') {
            wrapper.style.display = 'none';
            document.getElementById('self-avail-count').textContent = questionsBank.length;
            return;
        }
        const filtered = questionsBank.filter(q => q.subject === subj);
        const lessons = [...new Set(filtered.map(q => q.lesson))];
        wrapper.style.display = 'block';
        box.innerHTML = lessons.map(lesson => `
            <label style="display:inline-flex; align-items:center; gap:5px; background:#fff; padding:5px 10px; border-radius:20px; font-size:0.83rem; cursor:pointer; border:1px solid #cbd5e1;">
                <input type="checkbox" value="${lesson}" onchange="toggleSelfLesson(this.value, this.checked)">
                <span>${lesson}</span>
            </label>
        `).join('');
        updateSelfAvailableCount();
    };

    window.toggleSelfLesson = function(lesson, checked) {
        if (checked) selfSelectedLessons.add(lesson); else selfSelectedLessons.delete(lesson);
        updateSelfAvailableCount();
    };

    function updateSelfAvailableCount() {
        const subj = document.getElementById('self-subject').value;
        let pool = subj === 'all' ? questionsBank : questionsBank.filter(q => q.subject === subj);
        if (selfSelectedLessons.size > 0) pool = pool.filter(q => selfSelectedLessons.has(q.lesson));
        document.getElementById('self-avail-count').textContent = pool.length;
    }

    function showStudentLoginScreen(mins) {
        const modal = document.getElementById('exam-overlay');
        modal.style.display = 'block';
        const timeText = mins > 0 ? `<strong>${mins}</strong> دقيقة` : `<strong>مفتوح (بدون مؤقت)</strong>`;
        modal.innerHTML = `
            <div style="max-width:500px; margin:40px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08); text-align:right;">
                <h2 style="margin-top:0; color:#0f766e;">📋 ${activeExamTitle}</h2>
                <p style="color:#475569;">عدد الأسئلة: <strong>${examQuestions.length}</strong> سؤال | المدة: ${timeText}</p>
                <hr style="border:none; border-top:1px solid #e2e8f0; margin:15px 0;">
                <label style="display:block; font-weight:bold; margin-bottom:6px;">اسم الطالب الثلاثي (مطلوب):</label>
                <input id="stu-name" type="text" placeholder="اكتب اسمك الثلاثي..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; font-family:inherit;">
                <label style="display:block; font-weight:bold; margin-bottom:6px;">المدرسة أو الفصل (اختياري):</label>
                <input id="stu-school" type="text" placeholder="اكتب مدرستك أو فصلك..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:20px; font-family:inherit;">
                <button onclick="beginSharedExam(${mins})" style="width:100%; background:#0f766e; color:#fff; border:none; padding:12px; border-radius:10px; font-size:1.05rem; font-weight:bold; cursor:pointer; font-family:inherit;">✅ دخول الاختبار والبدء</button>
            </div>
        `;
    }

    window.startSelfExam = function() {
        const name = document.getElementById('stu-name').value.trim();
        if (!name) { alert("يرجى كتابة اسمك الثلاثي أولاً"); return; }
        studentInfo.name = name;
        studentInfo.school = document.getElementById('stu-school').value.trim() || "غير محدد";
        const subj = document.getElementById('self-subject').value;
        const count = parseInt(document.getElementById('self-count').value, 10);
        const chosenMins = parseInt(document.getElementById('self-time').value, 10);
        let pool = subj === 'all' ? [...questionsBank] : questionsBank.filter(q => q.subject === subj);
        if (selfSelectedLessons.size > 0) pool = pool.filter(q => selfSelectedLessons.has(q.lesson));
        if (pool.length === 0) { alert("لا توجد أسئلة متاحة في هذا الاختيار"); return; }
        pool.sort(() => Math.random() - 0.5);
        examQuestions = pool.slice(0, Math.min(count, pool.length));
        const lessonsLabel = selfSelectedLessons.size > 0 ? ` (${Array.from(selfSelectedLessons).join('، ')})` : '';
        activeExamTitle = subj === 'all' ? "اختبار تحصيلي شامل" : `اختبار ذاتي: ${subj}${lessonsLabel}`;
        launchExamEngine(chosenMins);
    };

    window.beginSharedExam = function(mins) {
        const name = document.getElementById('stu-name').value.trim();
        if (!name) { alert("يرجى كتابة اسمك الثلاثي أولاً"); return; }
        studentInfo.name = name;
        studentInfo.school = document.getElementById('stu-school').value.trim() || "غير محدد";
        launchExamEngine(mins);
    };

    function launchExamEngine(minutes) {
        currentExamIndex = 0;
        userAnswers = new Array(examQuestions.length).fill(null);
        clearInterval(examTimer);
        if (!minutes || minutes <= 0) {
            isUntimedExam = true;
            timeRemaining = 0;
        } else {
            isUntimedExam = false;
            timeRemaining = minutes * 60;
            examTimer = setInterval(() => {
                timeRemaining--;
                const timerEl = document.getElementById('exam-timer-display');
                if (timerEl) {
                    const m = Math.floor(timeRemaining / 60);
                    const s = timeRemaining % 60;
                    timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
                if (timeRemaining <= 0) {
                    clearInterval(examTimer);
                    finishExam();
                }
            }, 1000);
        }
        renderExamQuestion();
    }

    function renderExamQuestion() {
        const q = examQuestions[currentExamIndex];
        const modal = document.getElementById('exam-overlay');
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        const timerBadge = isUntimedExam
            ? `<span style="background:#e0f2fe; color:#0369a1; padding:4px 12px; border-radius:8px; font-weight:bold;">⏱ وقت مفتوح</span>`
            : `<span style="background:#fee2e2; color:#b91c1c; padding:4px 12px; border-radius:8px; font-weight:bold;">⏱ <span id="exam-timer-display">${m}:${s < 10 ? '0' : ''}${s}</span></span>`;

        let optionsHtml = q.options.map((opt, idx) => {
            const isSelected = userAnswers[currentExamIndex] === idx;
            return `<button onclick="selectExamOption(${idx})" style="display:block; width:100%; text-align:right; padding:12px 15px; margin-bottom:10px; border-radius:10px; border:2px solid ${isSelected ? '#0f766e' : '#e2e8f0'}; background:${isSelected ? '#f0fdfa' : '#fff'}; font-weight:${isSelected ? 'bold' : 'normal'}; cursor:pointer; font-family:inherit; font-size:1rem;">${opt}</button>`;
        }).join('');

        modal.innerHTML = `
            <div style="max-width:700px; margin:20px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:12px 16px; border-radius:10px; margin-bottom:20px;">
                    <span>👤 <strong>${studentInfo.name}</strong></span>
                    ${timerBadge}
                    <span>سؤال <strong>${currentExamIndex + 1}</strong> من <strong>${examQuestions.length}</strong></span>
                </div>
                <div style="font-size:0.85rem; color:#0284c7; margin-bottom:8px; font-weight:bold;">${q.subject} - ${q.lesson}</div>
                <h3 style="margin-top:0; margin-bottom:20px; line-height:1.6;">${q.question}</h3>
                <div>${optionsHtml}</div>
                <div style="display:flex; justify-content:space-between; margin-top:25px; gap:10px;">
                    <button onclick="prevExamQ()" ${currentExamIndex === 0 ? 'disabled' : ''} style="padding:10px 20px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; font-family:inherit;">السابق</button>
                    ${currentExamIndex < examQuestions.length - 1 
                        ? `<button onclick="nextExamQ()" style="padding:10px 24px; border-radius:8px; border:none; background:#0284c7; color:#fff; font-weight:bold; cursor:pointer; font-family:inherit;">التالي ⬅</button>`
                        : `<button onclick="finishExam()" style="padding:10px 24px; border-radius:8px; border:none; background:#16a34a; color:#fff; font-weight:bold; cursor:pointer; font-family:inherit;">✅ تسليم الاختبار وعرض النتيجة</button>`
                    }
                </div>
            </div>
        `;
    }

    window.selectExamOption = function(idx) { userAnswers[currentExamIndex] = idx; renderExamQuestion(); };
    window.nextExamQ = function() { if (currentExamIndex < examQuestions.length - 1) { currentExamIndex++; renderExamQuestion(); } };
    window.prevExamQ = function() { if (currentExamIndex > 0) { currentExamIndex--; renderExamQuestion(); } };

    window.finishExam = function() {
        clearInterval(examTimer);
        let score = 0;
        lastWrongQuestions = [];
        examQuestions.forEach((q, i) => {
            if (userAnswers[i] === q.correctIndex) score++;
            else lastWrongQuestions.push(q);
        });
        const total = examQuestions.length;
        const percent = Math.round((score / total) * 100);

        let count = parseInt(localStorage.getItem('bio_exam_count') || '0', 10) + 1;
        localStorage.setItem('bio_exam_count', count);
        const badge = document.getElementById('exam-counter-val');
        if (badge) badge.textContent = count;

        let reviewHtml = examQuestions.map((q, i) => {
            const uAns = userAnswers[i];
            const isCorrect = uAns === q.correctIndex;
            return `
                <div style="border:1px solid ${isCorrect ? '#86efac' : '#fca5a5'}; background:${isCorrect ? '#f0fdf4' : '#fef2f2'}; padding:15px; border-radius:10px; margin-bottom:12px;">
                    <div style="font-weight:bold; margin-bottom:6px;">${i + 1}. ${q.question}</div>
                    <div>إجابتك: <strong>${uAns !== null ? q.options[uAns] : 'لم تُجب'}</strong> ${isCorrect ? '✅' : '❌'}</div>
                    ${!isCorrect ? `<div style="color:#15803d; margin-top:4px;">الإجابة الصحيحة: <strong>${q.options[q.correctIndex]}</strong></div>` : ''}
                    <div style="margin-top:8px; font-size:0.9rem; color:#334155; background:#fff; padding:8px; border-radius:6px;">💡 <strong>الشرح:</strong> ${q.explanation}</div>
                </div>
            `;
        }).join('');

        const certBtn = percent >= 85
            ? `<button onclick="openCertificateModal(${score}, ${total}, ${percent})" style="background:#eab308; color:#1e293b; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; font-family:inherit;">🏅 عرض وطباعة شهادة التفوق</button>`
            : '';

        const retryWrongBtn = lastWrongQuestions.length > 0
            ? `<button onclick="retryWrongQuestions()" style="background:#dc2626; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; font-family:inherit;">🔁 تدرب على أخطائك فقط (${lastWrongQuestions.length})</button>`
            : '';

        const modal = document.getElementById('exam-overlay');
        modal.innerHTML = `
            <div style="max-width:750px; margin:20px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="text-align:center; background:linear-gradient(135deg, #0f766e, #0284c7); color:#fff; padding:25px; border-radius:14px; margin-bottom:20px;">
                    <h2 style="margin:0 0 10px 0;">🎓 بطاقة نتيجة الاختبار</h2>
                    <div style="font-size:1.1rem; margin-bottom:6px;">الطالب: <strong>${studentInfo.name}</strong> (${studentInfo.school})</div>
                    <div style="font-size:0.95rem; opacity:0.9; margin-bottom:15px;">${activeExamTitle}</div>
                    <div style="font-size:2.2rem; font-weight:bold; margin-bottom:12px;">${score} / ${total} (${percent}%)</div>
                    <div id="sheet-sync-status" style="display:inline-block; background:rgba(255,255,255,0.2); padding:6px 14px; border-radius:20px; font-size:0.88rem;">⏳ جاري تسجيل نتيجتك في سجل أ. أحمد إمام...</div>
                </div>
                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin-bottom:20px;">
                    ${certBtn}
                    ${retryWrongBtn}
                    <button onclick="closeExamOverlay()" style="background:#1e293b; color:#fff; border:none; padding:10px 24px; border-radius:8px; font-weight:bold; cursor:pointer; font-family:inherit;">العودة لبنك الأسئلة</button>
                </div>
                <h3 style="color:#0f766e; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">📋 مراجعة الإجابات والشرح التفصيلي:</h3>
                ${reviewHtml}
            </div>
        `;

        sendResultToGoogleSheet({
            name: studentInfo.name,
            school: studentInfo.school,
            examTitle: activeExamTitle,
            score: score,
            total: total,
            percent: percent
        });
    };

    window.retryWrongQuestions = function() {
        if (lastWrongQuestions.length === 0) return;
        examQuestions = [...lastWrongQuestions];
        activeExamTitle = "مراجعة الأخطاء: " + activeExamTitle;
        launchExamEngine(0);
    };

    window.openCertificateModal = function(score, total, percent) {
        const today = new Date().toLocaleDateString('ar-SA');
        const certWindow = window.open('', '_blank', 'width=850,height=620');
        certWindow.document.write(`
            <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>شهادة تفوق - ${studentInfo.name}</title>
            <style>body{font-family:Tahoma,sans-serif;background:#f1f5f9;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}.cert{width:760px;background:#fff;border:12px double #0f766e;padding:40px;text-align:center;}h1{color:#0f766e;font-size:2.2rem;}.name{font-size:1.9rem;font-weight:bold;color:#1e293b;border-bottom:2px solid #eab308;display:inline-block;padding:5px 30px;margin:15px 0;}.details{font-size:1.15rem;color:#334155;line-height:1.9;margin:20px 0;}.footer{display:flex;justify-content:space-between;margin-top:40px;padding:0 30px;font-weight:bold;color:#0f766e;}@media print{body{background:#fff;}.no-print{display:none;}}</style>
            </head><body><div class="cert"><div style="font-size:3rem;">🏅</div><h1>شهادة شكر وتفوق</h1><div>منصة أ. أحمد إمام التعليمية للأحياء والتحصيلي</div>
            <p>تُمنح هذه الشهادة بكل فخر واعتزاز للطالب المتميز:</p><div class="name">${studentInfo.name}</div>
            <div class="details">وذلك لتفوقه واجتيازه <strong>(${activeExamTitle})</strong><br>بدرجة <strong>${score} من ${total}</strong> وبنسبة مئوية قدرها <strong>${percent}%</strong></div>
            <div class="footer"><div>التاريخ: ${today}</div><div>معلم المادة: أ. أحمد إمام</div></div>
            <button class="no-print" onclick="window.print()" style="margin-top:25px;background:#0f766e;color:#fff;border:none;padding:10px 25px;border-radius:8px;font-size:1rem;cursor:pointer;">🖨️ طباعة أو حفظ الشهادة PDF</button></div></body></html>
        `);
        certWindow.document.close();
    };

    window.closeExamOverlay = function() { clearInterval(examTimer); document.getElementById('exam-overlay').style.display = 'none'; };

    window.openTeacherPanel = function() {
        const pass = prompt("أدخل رمز المعلم:");
        if (pass !== TEACHER_PIN) { alert("رمز غير صحيح"); return; }
        selectedForExam.clear();
        teacherSelectedLessons.clear();
        const modal = document.getElementById('exam-overlay');
        modal.style.display = 'block';
        const subjects = [...new Set(questionsBank.map(q => q.subject))];
        const subjOptions = subjects.map(s => `<option value="${s}">${s}</option>`).join('');

        modal.innerHTML = `
            <div style="max-width:800px; margin:20px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:15px;">
                    <h2 style="margin:0; color:#1e293b;">🔐 لوحة المعلم - إنشاء اختبار مخصص</h2>
                    <div style="display:flex; gap:8px;">
                        <a href="${GOOGLE_DRIVE_SHEET_SEARCH}" target="_blank" style="background:#16a34a; color:#fff; text-decoration:none; padding:6px 12px; border-radius:8px; font-weight:bold; font-size:0.88rem;">📊 جدول نتائج الطلاب</a>
                        <button onclick="closeExamOverlay()" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">إغلاق ✖</button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:14px;">
                    <input id="t-exam-title" type="text" placeholder="عنوان الاختبار" style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;">
                    <input id="t-exam-mins" type="number" value="15" min="0" max="120" placeholder="المدة بالدقائق" style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;">
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:10px; margin-bottom:14px;">
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#0f766e;">1️⃣ اختر المقرر الدراسي:</label>
                    <select id="t-subject-filter" onchange="onTeacherSubjectChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit; margin-bottom:10px;">
                        <option value="all">جميع المقررات</option>
                        ${subjOptions}
                    </select>
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#0f766e;">2️⃣ حدد درساً واحداً أو أكثر:</label>
                    <div id="t-lessons-box" style="display:flex; flex-wrap:wrap; gap:6px; max-height:130px; overflow-y:auto; padding:6px; background:#fff; border:1px solid #cbd5e1; border-radius:8px;"></div>
                </div>
                <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="font-weight:bold;">3️⃣ الأسئلة المطابقة (<span id="filtered-q-total">0</span>) | المختار: <span id="sel-q-count" style="color:#0f766e; font-size:1.1rem;">0</span></div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" onclick="selectAllFilteredQ(true)" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-family:inherit;">تحديد الكل</button>
                        <button type="button" onclick="selectRandomFilteredQ()" style="background:#f59e0b; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-family:inherit;">🎲 اختيار عشوائي</button>
                        <button type="button" onclick="selectAllFilteredQ(false)" style="background:#64748b; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-family:inherit;">إلغاء التحديد</button>
                    </div>
                </div>
                <div id="t-questions-list" style="max-height:260px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:15px;"></div>
                <button onclick="generateExamLink()" style="width:100%; background:#0f766e; color:#fff; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; font-family:inherit; font-size:1rem;">🔗 توليد رابط الاختبار لنسخه وإرساله للطلاب</button>
                <div id="generated-link-box" style="display:none; margin-top:15px; background:#f0fdf4; border:1px solid #86efac; padding:12px; border-radius:8px;">
                    <div style="font-weight:bold; color:#15803d; margin-bottom:8px;">✅ تم إنشاء الرابط ونسخه! أرسله لطلابك:</div>
                    <input id="final-exam-url" type="text" readonly style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; direction:ltr; margin-bottom:10px;">
                    <button type="button" onclick="shareExamWhatsApp()" style="width:100%; background:#25D366; color:#fff; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; font-family:inherit; font-size:0.95rem;">📲 إرسال الاختبار مباشرة عبر واتساب</button>
                </div>
            </div>
        `;
        onTeacherSubjectChange();
    };

    window.onTeacherSubjectChange = function() {
        const subj = document.getElementById('t-subject-filter').value;
        teacherSelectedLessons.clear();
        const filteredBySubj = subj === 'all' ? questionsBank : questionsBank.filter(q => q.subject === subj);
        const lessons = [...new Set(filteredBySubj.map(q => q.lesson))];
        const lessonsBox = document.getElementById('t-lessons-box');
        lessonsBox.innerHTML = lessons.map(lesson => `
            <label style="display:inline-flex; align-items:center; gap:5px; background:#f1f5f9; padding:5px 10px; border-radius:20px; font-size:0.85rem; cursor:pointer; border:1px solid #cbd5e1;">
                <input type="checkbox" value="${lesson}" onchange="toggleTeacherLesson(this.value, this.checked)">
                <span>${lesson}</span>
            </label>
        `).join('');
        renderTeacherFilteredQuestions();
    };

    window.toggleTeacherLesson = function(lesson, checked) {
        if (checked) teacherSelectedLessons.add(lesson); else teacherSelectedLessons.delete(lesson);
        renderTeacherFilteredQuestions();
    };

    function renderTeacherFilteredQuestions() {
        const subj = document.getElementById('t-subject-filter').value;
        teacherCurrentFilteredIndices = [];
        questionsBank.forEach((q, idx) => {
            if ((subj === 'all' || q.subject === subj) && (teacherSelectedLessons.size === 0 || teacherSelectedLessons.has(q.lesson))) {
                teacherCurrentFilteredIndices.push(idx);
            }
        });
        document.getElementById('filtered-q-total').textContent = teacherCurrentFilteredIndices.length;
        const listEl = document.getElementById('t-questions-list');
        if (teacherCurrentFilteredIndices.length === 0) {
            listEl.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px;">لا توجد أسئلة مطابقة لهذا الاختيار.</div>`;
            return;
        }
        listEl.innerHTML = teacherCurrentFilteredIndices.map(idx => {
            const q = questionsBank[idx];
            const isChecked = selectedForExam.has(idx) ? 'checked' : '';
            return `<label style="display:block; padding:8px; border-bottom:1px solid #f1f5f9; cursor:pointer;"><input type="checkbox" ${isChecked} onchange="toggleQSelect(${idx}, this.checked)"> <span style="font-size:0.8rem; color:#0284c7; font-weight:bold;">[${q.subject} - ${q.lesson}]</span> ${q.question}</label>`;
        }).join('');
    }

    window.selectAllFilteredQ = function(selectAll) {
        teacherCurrentFilteredIndices.forEach(idx => { if (selectAll) selectedForExam.add(idx); else selectedForExam.delete(idx); });
        document.getElementById('sel-q-count').textContent = selectedForExam.size;
        renderTeacherFilteredQuestions();
    };

    window.selectRandomFilteredQ = function() {
        if (teacherCurrentFilteredIndices.length === 0) return;
        const countStr = prompt(`كم سؤالاً عشوائياً تريد اختياره من هذه الدروس؟ (المتاح: ${teacherCurrentFilteredIndices.length})`, "10");
        const num = parseInt(countStr, 10);
        if (!num || num <= 0) return;
        const shuffled = [...teacherCurrentFilteredIndices].sort(() => Math.random() - 0.5);
        shuffled.slice(0, Math.min(num, shuffled.length)).forEach(idx => selectedForExam.add(idx));
        document.getElementById('sel-q-count').textContent = selectedForExam.size;
        renderTeacherFilteredQuestions();
    };

    window.toggleQSelect = function(idx, checked) {
        if (checked) selectedForExam.add(idx); else selectedForExam.delete(idx);
        document.getElementById('sel-q-count').textContent = selectedForExam.size;
    };

    window.generateExamLink = function() {
        if (selectedForExam.size === 0) { alert("اختر سؤالاً واحداً على الأقل"); return; }
        const title = document.getElementById('t-exam-title').value.trim() || "اختبار تحصيلي - أ. أحمد إمام";
        const minsVal = parseInt(document.getElementById('t-exam-mins').value, 10);
        const mins = isNaN(minsVal) ? 15 : minsVal;
        const payload = { t: title, m: mins, q: Array.from(selectedForExam) };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const baseUrl = window.location.origin + window.location.pathname;
        lastGeneratedUrl = `${baseUrl}?exam=${encoded}`;
        document.getElementById('generated-link-box').style.display = 'block';
        const urlInput = document.getElementById('final-exam-url');
        urlInput.value = lastGeneratedUrl;
        urlInput.select();
        navigator.clipboard?.writeText(lastGeneratedUrl);
    };

    window.shareExamWhatsApp = function() {
        if (!lastGeneratedUrl) return;
        const title = document.getElementById('t-exam-title').value.trim() || "اختبار تحصيلي - أ. أحمد إمام";
        const minsVal = parseInt(document.getElementById('t-exam-mins').value, 10);
        const timeInfo = (!isNaN(minsVal) && minsVal > 0) ? `${minsVal} دقيقة` : "مفتوح";
        const msg = `📋 *${title}*\n👨‍🏫 إعداد: أ. أحمد إمام\n❓ عدد الأسئلة: ${selectedForExam.size} سؤال\n⏱ المدة: ${timeInfo}\n\n🔗 رابط الدخول للاختبار:\n${lastGeneratedUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };
})();
