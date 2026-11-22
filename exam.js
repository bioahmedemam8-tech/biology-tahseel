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
    
