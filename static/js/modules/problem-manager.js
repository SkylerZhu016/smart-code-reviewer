// 题目管理器模块 - 负责题目的加载、显示、创建和删除
export class ProblemManager {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
    }

    init() {
        this.initAddProblemButton();
        this.initProblemForm();
        this.initAddTestCaseButton();
        // 加载题目列表
        this.loadProblems();
    }

    // 加载题目列表
    async loadProblems() {
        try {
            const response = await fetch('/api/problems');
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const problems = await response.json();
            this.appState.setProblems(problems);
            this.renderProblemList();
        } catch (error) {
            this.uiManager.displayNotification('加载题目列表失败', 'error');
            console.error('Load problems error:', error);
        }
    }

    // 渲染题目列表
    renderProblemList() {
        const problems = this.appState.getProblems();
        const userRole = this.appState.getUserRole();
        
        this.elements.problemList.innerHTML = '';
        problems.forEach(problem => {
            const li = document.createElement('li');
            li.setAttribute('data-id', problem.id);
            li.innerHTML = `<span>${problem.title}</span>`;
            
            if (userRole === 'teacher') {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.className = 'delete-problem-btn';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除题目 "${problem.title}" 吗？`)) {
                        this.deleteProblem(problem.id);
                    }
                };
                li.appendChild(deleteBtn);
            }
            
            li.addEventListener('click', () => this.selectProblem(problem.id));
            this.elements.problemList.appendChild(li);
        });
    }

    // 选择题目
    async selectProblem(problemId) {
        this.uiManager.showGlobalLoadingModal('正在加载题目...');
        try {
            const response = await fetch(`/api/problems/${problemId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }
            
            const problemData = await response.json();
            
            if (problemData.error) {
                throw new Error(problemData.error);
            }
            
            this.uiManager.hideGlobalLoadingModal();
            this.appState.setActiveProblem(problemData);
            
            document.querySelectorAll('#problem-list li').forEach(li => li.classList.remove('active'));
            document.querySelector(`#problem-list li[data-id="${problemId}"]`)?.classList.add('active');

            // 清理旧状态
            this.resetStudentView();
            this.appState.setCurrentSubmissionId(null);

            const userRole = this.appState.getUserRole();
            if (userRole === 'teacher') {
                this.setupTeacherView(problemData);
            } else { // Student Role
                this.setupStudentView(problemData);
            }
        } catch (error) {
            this.uiManager.hideGlobalLoadingModal();
            console.error('加载题目详情失败:', error);
            this.uiManager.displayNotification(`加载题目详情失败: ${error.message}`, 'error');
        }
    }

    // 设置教师视图
    setupTeacherView(problemData) {
        document.getElementById('teacher-view-title').textContent = '编辑题目';
        document.getElementById('problem-title').value = problemData.title;
        document.getElementById('problem-description').value = problemData.description_md || '';
        this.elements.testCaseList.innerHTML = '';
        problemData.test_cases.forEach(tc => this.addTestCaseItem(tc));
        
        const codeEditor = this.appState.getCodeEditor();
        if (codeEditor) {
            codeEditor.setValue(`# 教师视图\n# 可以在此粘贴学生代码进行测试或获取AI分析`);
            codeEditor.updateOptions({ readOnly: false });
        }
        
        // 加载提交列表需要从SubmissionManager调用
        if (this.submissionManager) {
            this.submissionManager.loadSubmissionsForProblem(problemData.id);
        }
    }

    // 设置学生视图
    setupStudentView(problemData) {
        document.getElementById('student-view-title').textContent = problemData.title;
        
        try {
            if (typeof marked !== 'undefined') {
                this.elements.problemDescriptionContent.innerHTML = marked.parse(problemData.description_md || '# 题目描述为空');
            } else {
                this.elements.problemDescriptionContent.textContent = problemData.description_md || '# 题目描述为空';
            }
        } catch (e) {
            this.elements.problemDescriptionContent.textContent = problemData.description_md || '题目描述为空';
        }
        
        // 恢复学生上次的提交
        if (this.studentView) {
            const studentId = this.appState.getStudentId();
            // 确保学号输入框与全局状态同步
            if (this.elements.studentIdInput) {
                this.elements.studentIdInput.value = studentId || '';
            }
            
            // 确保学号存在且有效
            if (studentId && /^\d+$/.test(studentId)) {
                this.studentView.loadLatestStudentSubmission(problemData.id, studentId);
            } else {
                console.warn('学号无效或为空，跳过加载历史提交');
                // 重置学生视图
                if (this.studentView && this.studentView.resetStudentView) {
                    this.studentView.resetStudentView();
                    // 显示提示信息
                    this.uiManager.displayNotification('请输入有效的学号以开始编程', 'info');
                }
            }
        }
    }

    // 删除题目
    async deleteProblem(problemId) {
        this.uiManager.showGlobalLoadingModal('正在删除题目...');
        try {
            const response = await fetch(`/api/problems/${problemId}`, { method: 'DELETE' });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const data = await response.json();
            this.uiManager.hideGlobalLoadingModal();
            
            if (data.status === 'success') {
                this.uiManager.displayNotification('题目删除成功', 'success');
                this.loadProblems(); 
                const activeProblem = this.appState.getActiveProblem();
                if(activeProblem && activeProblem.id === problemId) {
                    this.resetTeacherView();
                }
            } else {
                this.uiManager.displayNotification(`删除失败: ${data.message}`, 'error');
            }
        } catch (error) {
            this.uiManager.hideGlobalLoadingModal();
            this.uiManager.displayNotification(`删除题目失败: ${error.message}`, 'error');
        }
    }

    // 重置教师视图
    resetTeacherView() {
        this.appState.setActiveProblem(null);
        this.appState.setCurrentSubmissionId(null);
        document.getElementById('teacher-view-title').textContent = '发布新题目';
        this.elements.problemForm.reset();
        this.elements.testCaseList.innerHTML = '';
        document.querySelectorAll('#problem-list li').forEach(li => li.classList.remove('active'));
        
        const codeEditor = this.appState.getCodeEditor();
        if (codeEditor) {
            codeEditor.setValue('# 请从左侧选择一个题目...');
            codeEditor.updateOptions({ readOnly: true });
        }
        this.elements.submissionList.innerHTML = '<p>请先从左侧选择一个题目以查看提交。</p>';
    }

    // 重置学生视图
    resetStudentView() {
        const codeEditor = this.appState.getCodeEditor();
        if (codeEditor) {
            codeEditor.setValue('# 请在此输入你的代码...');
            codeEditor.updateOptions({ readOnly: false });
        }
        this.elements.testTab.innerHTML = '';
        this.elements.aiTab.innerHTML = '';
        this.elements.runTab.innerHTML = '';
        this.elements.chatDisplay.innerHTML = '<div class="chat-message ai-message"><p>你好，我是你的AI编程导师。有任何关于代码的问题都可以问我！</p></div>';
    }

    // 添加测试用例项
    addTestCaseItem(testCase = { input_data: '', expected_output: '' }) {
        const li = document.createElement('li');
        li.className = 'test-case-item';
        li.innerHTML = `
            <div class="form-group"><label>输入数据 (可选)</label><textarea class="test-input" rows="2">${testCase.input_data}</textarea></div>
            <div class="form-group"><label>期望输出 (可选)</label><textarea class="test-output" rows="2">${testCase.expected_output}</textarea></div>
            <button type="button" class="remove-test-case">删除</button>
        `;
        li.querySelector('.remove-test-case').addEventListener('click', () => li.remove());
        this.elements.testCaseList.appendChild(li);
    }

    // 初始化添加题目按钮
    initAddProblemButton() {
        this.elements.addProblemBtn.addEventListener('click', () => this.resetTeacherView());
    }

    // 初始化题目表单
    initProblemForm() {
        this.elements.problemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const activeProblem = this.appState.getActiveProblem();
            const problemId = activeProblem ? activeProblem.id : null;
            const title = document.getElementById('problem-title').value;
            const descriptionMd = document.getElementById('problem-description').value;
            const testCases = Array.from(document.querySelectorAll('.test-case-item')).map(item => ({
                input_data: item.querySelector('.test-input').value,
                expected_output: item.querySelector('.test-output').value
            }));

            if (!title.trim() || !descriptionMd.trim()) {
                this.uiManager.displayNotification('题目名称和描述不能为空', 'error');
                return;
            }

            this.uiManager.showGlobalLoadingModal('正在发布题目...');
            try {
                const response = await fetch(`/api/problems${problemId ? `/${problemId}` : ''}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description_md: descriptionMd, test_cases: testCases }),
                    signal: this.appState.getAbortController()?.signal
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status}`);
                }
                
                const data = await response.json();
                this.uiManager.hideGlobalLoadingModal();
                
                if (data.status === 'success') {
                    this.uiManager.displayNotification('题目发布成功！', 'success');
                    await this.loadProblems();
                    this.selectProblem(data.problem_id);
                } else {
                    this.uiManager.displayNotification(`发布失败: ${data.message}`, 'error');
                }
            } catch (error) {
                this.uiManager.hideGlobalLoadingModal();
                if (error.name !== 'AbortError') {
                    this.uiManager.displayNotification(`发布题目失败: ${error.message}`, 'error');
                }
            }
        });
    }

    // 初始化添加测试用例按钮
    initAddTestCaseButton() {
        this.elements.addTestCaseBtn.addEventListener('click', () => this.addTestCaseItem());
    }

    // 设置依赖管理器
    setSubmissionManager(submissionManager) {
        this.submissionManager = submissionManager;
    }

    setStudentView(studentView) {
        this.studentView = studentView;
    }
}