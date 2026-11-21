// نظام الاختبارات الذاتية ولوحة المعلم - منصة أ. أحمد إمام
(function() {
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

    // إنشاء واجهة الأزرار العلوية والعداد
    window.addEventListener('DOMContentLoaded', () => {
        const header = document.querySelector('header');
        if (!header) return;

        // عداد الطلاب المختبرين
        const savedCount = parseInt(localStorage.getItem('bio_exam_count') || '128', 10);
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
            <div style="max-width:550px; margin:30px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0; color:#0f766e;">📝 إعداد اختبار تحصيلي ذاتي</h2>
                    <button onclick="closeExamOverlay()" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">إغلاق ✖</button>
                </div>
                <label style="display:block; font-weight:bold; margin-bottom:6px;">اسم الطالب الثلاثي (مطلوب):</label>
                <input id="stu-name" type="text" placeholder="اكتب اسمك الثلاثي هنا..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; font-family:inherit;">
                
                <label style="display:block; font-weight:bold; margin-bottom:6px;">المدرسة أو المدينة (اختياري):</label>
                <input id="stu-school" type="text" placeholder="مثال: ثانوية أضواء البيان / ينبع..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; font-family:inherit;">

                <label style="display:block; font-weight:bold; margin-bottom:6px;">اختر المقرر:</label>
                <select id="self-subject" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; font-family:inherit;">
                    <option value="all">شامل جميع المقررات (250 سؤال)</option>
                    <option value="أحياء 1">أحياء 1</option>
                    <option value="أحياء 2-1">أحياء 2-1</option>
                    <option value="أحياء 2-2">أحياء 2-2</option>
                    <option value="أحياء 3">أحياء 3</option>
                    <option value="علم البيئة">علم البيئة</option>
                </select>

                <label style="display:block; font-weight:bold; margin-bottom:6px;">عدد الأسئلة والمدة:</label>
                <select id="self-count" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:20px; font-family:inherit;">
                    <option value="10">10 أسئلة (10 دقائق)</option>
                    <option value="20" selected>20 سؤالاً (20 دقيقة)</option>
                    <option value="30">30 سؤالاً (30 دقيقة)</option>
                    <option value="50">50 سؤالاً (50 دقيقة)</option>
                </select>

                <button onclick="startSelfExam()" style="width:100%; background:#0f766e; color:#fff; border:none; padding:12px; border-radius:10px; font-size:1.05rem; font-weight:bold; cursor:pointer; font-family:inherit;">
                    🚀 ابدأ الاختبار الآن
                </button>
            </div>
        `;
    };

    // شاشة تسجيل الدخول لاختبار المعلم المرسل عبر الرابط
    function showStudentLoginScreen(mins) {
        const modal = document.getElementById('exam-overlay');
        modal.style.display = 'block';
        modal.innerHTML = `
            <div style="max-width:500px; margin:40px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08); text-align:right;">
                <h2 style="margin-top:0; color:#0f766e;">📋 ${activeExamTitle}</h2>
                <p style="color:#475569;">عدد الأسئلة: <strong>${examQuestions.length}</strong> سؤال | المدة: <strong>${mins}</strong> دقيقة</p>
                <hr style="border:none; border-top:1px solid #e2e8f0; margin:15px 0;">
                <label style="display:block; font-weight:bold; margin-bottom:6px;">اسم الطالب الثلاثي (مطلوب):</label>
                <input id="stu-name" type="text" placeholder="اكتب اسمك الثلاثي..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; font-family:inherit;">
                
                <label style="display:block; font-weight:bold; margin-bottom:6px;">المدرسة أو الفصل (اختياري):</label>
                <input id="stu-school" type="text" placeholder="اكتب مدرستك أو فصلك..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:20px; font-family:inherit;">

                <button onclick="beginSharedExam(${mins})" style="width:100%; background:#0f766e; color:#fff; border:none; padding:12px; border-radius:10px; font-size:1.05rem; font-weight:bold; cursor:pointer; font-family:inherit;">
                    ✅ دخول الاختبار وبدء الوقت
                </button>
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

        let pool = subj === 'all' ? [...questionsBank] : questionsBank.filter(q => q.subject === subj);
        pool.sort(() => Math.random() - 0.5);
        examQuestions = pool.slice(0, Math.min(count, pool.length));
        activeExamTitle = subj === 'all' ? "اختبار تحصيلي شامل" : `اختبار مقرر ${subj}`;
        launchExamEngine(count);
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
        timeRemaining = minutes * 60;
        clearInterval(examTimer);
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
        renderExamQuestion();
    }

    function renderExamQuestion() {
        const q = examQuestions[currentExamIndex];
        const modal = document.getElementById('exam-overlay');
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;

        let optionsHtml = q.options.map((opt, idx) => {
            const isSelected = userAnswers[currentExamIndex] === idx;
            return `
                <button onclick="selectExamOption(${idx})" style="display:block; width:100%; text-align:right; padding:12px 15px; margin-bottom:10px; border-radius:10px; border:2px solid ${isSelected ? '#0f766e' : '#e2e8f0'}; background:${isSelected ? '#f0fdfa' : '#fff'}; font-weight:${isSelected ? 'bold' : 'normal'}; cursor:pointer; font-family:inherit; font-size:1rem;">
                    ${opt}
                </button>
            `;
        }).join('');

        modal.innerHTML = `
            <div style="max-width:700px; margin:20px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:12px 16px; border-radius:10px; margin-bottom:20px;">
                    <span>👤 <strong>${studentInfo.name}</strong></span>
                    <span style="background:#fee2e2; color:#b91c1c; padding:4px 12px; border-radius:8px; font-weight:bold;">⏱ <span id="exam-timer-display">${m}:${s < 10 ? '0' : ''}${s}</span></span>
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

    window.selectExamOption = function(idx) {
        userAnswers[currentExamIndex] = idx;
        renderExamQuestion();
    };
    window.nextExamQ = function() { if (currentExamIndex < examQuestions.length - 1) { currentExamIndex++; renderExamQuestion(); } };
    window.prevExamQ = function() { if (currentExamIndex > 0) { currentExamIndex--; renderExamQuestion(); } };

    window.finishExam = function() {
        clearInterval(examTimer);
        let score = 0;
        examQuestions.forEach((q, i) => { if (userAnswers[i] === q.correctIndex) score++; });
        const percent = Math.round((score / examQuestions.length) * 100);

        // زيادة عداد المختبرين
        let count = parseInt(localStorage.getItem('bio_exam_count') || '128', 10) + 1;
        localStorage.setItem('bio_exam_count', count);
        const badge = document.getElementById('exam-counter-val');
        if (badge) badge.textContent = count;

        // بناء تقرير المراجعة والشرح في النهاية فقط
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

        const modal = document.getElementById('exam-overlay');
        modal.innerHTML = `
            <div style="max-width:750px; margin:20px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="text-align:center; background:linear-gradient(135deg, #0f766e, #0284c7); color:#fff; padding:25px; border-radius:14px; margin-bottom:20px;">
                    <h2 style="margin:0 0 10px 0;">🎓 بطاقة نتيجة الاختبار</h2>
                    <div style="font-size:1.1rem; margin-bottom:6px;">الطالب: <strong>${studentInfo.name}</strong> (${studentInfo.school})</div>
                    <div style="font-size:0.95rem; opacity:0.9; margin-bottom:15px;">${activeExamTitle}</div>
                    <div style="font-size:2.2rem; font-weight:bold;">${score} / ${examQuestions.length} (${percent}%)</div>
                </div>

                <div style="text-align:center; margin-bottom:20px;">
                    <button onclick="closeExamOverlay()" style="background:#1e293b; color:#fff; border:none; padding:10px 24px; border-radius:8px; font-weight:bold; cursor:pointer; font-family:inherit;">العودة لبنك الأسئلة</button>
                </div>

                <h3 style="color:#0f766e; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">📋 مراجعة الإجابات والشرح التفصيلي:</h3>
                ${reviewHtml}
            </div>
        `;
    };

    window.closeExamOverlay = function() {
        clearInterval(examTimer);
        document.getElementById('exam-overlay').style.display = 'none';
    };

    // لوحة المعلم لإنشاء اختبار وتوليد الرابط
    window.openTeacherPanel = function() {
        const pass = prompt("أدخل رمز المعلم (الافتراضي: 2026):");
        if (pass !== "2026") { alert("رمز غير صحيح"); return; }

        selectedForExam.clear();
        const modal = document.getElementById('exam-overlay');
        modal.style.display = 'block';

        let listHtml = questionsBank.map((q, idx) => `
            <label style="display:block; padding:8px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <input type="checkbox" onchange="toggleQSelect(${idx}, this.checked)">
                <span style="font-size:0.8rem; color:#0284c7; font-weight:bold;">[${q.subject}]</span> ${q.question}
            </label>
        `).join('');

        modal.innerHTML = `
            <div style="max-width:750px; margin:20px auto; background:#fff; padding:25px; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="margin:0; color:#1e293b;">🔐 لوحة المعلم - إنشاء اختبار للطلاب</h2>
                    <button onclick="closeExamOverlay()" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">إغلاق ✖</button>
                </div>

                <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:15px;">
                    <input id="t-exam-title" type="text" placeholder="عنوان الاختبار (مثلاً: اختبار دوري 1)" style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;">
                    <input id="t-exam-mins" type="number" value="15" min="1" max="120" placeholder="المدة بالدقائق" style="padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;">
                </div>

                <div style="margin-bottom:10px; font-weight:bold;">اختر الأسئلة من البنك (المختار: <span id="sel-q-count">0</span>):</div>
                <div style="max-height:300px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:15px;">
                    ${listHtml}
                </div>

                <button onclick="generateExamLink()" style="width:100%; background:#0f766e; color:#fff; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; font-family:inherit;">
                    🔗 توليد رابط الاختبار لنسخه وإرساله للطلاب
                </button>
                <div id="generated-link-box" style="display:none; margin-top:15px; background:#f0fdf4; border:1px solid #86efac; padding:12px; border-radius:8px;">
                    <div style="font-weight:bold; color:#15803d; margin-bottom:6px;">✅ تم إنشاء الرابط! انسخه وأرسله لطلابك:</div>
                    <input id="final-exam-url" type="text" readonly style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; direction:ltr;">
                </div>
            </div>
        `;
    };

    window.toggleQSelect = function(idx, checked) {
        if (checked) selectedForExam.add(idx); else selectedForExam.delete(idx);
        document.getElementById('sel-q-count').textContent = selectedForExam.size;
    };

    window.generateExamLink = function() {
        if (selectedForExam.size === 0) { alert("اختر سؤالاً واحداً على الأقل"); return; }
        const title = document.getElementById('t-exam-title').value.trim() || "اختبار تحصيلي - أ. أحمد إمام";
        const mins = parseInt(document.getElementById('t-exam-mins').value, 10) || 15;
        const payload = { t: title, m: mins, q: Array.from(selectedForExam) };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const baseUrl = window.location.origin + window.location.pathname;
        const fullUrl = `${baseUrl}?exam=${encoded}`;

        document.getElementById('generated-link-box').style.display = 'block';
        const urlInput = document.getElementById('final-exam-url');
        urlInput.value = fullUrl;
        urlInput.select();
        navigator.clipboard?.writeText(fullUrl);
    };
})();
