// 身份认证管理器模块 - 负责用户身份选择和验证
export class AuthManager {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
    }

    init() {
        this.initTeacherButton();
        this.initStudentButton();
        this.initStudentIdEntry();
        this.initBackButton();
        this.initStudentIdInputSync();
    }

    // 教师身份选择
    initTeacherButton() {
        this.elements.teacherBtn.addEventListener('click', () => {
            this.appState.setUserRole('teacher');
            this.uiManager.setupMainApp();
            this.uiManager.transitionToScreen(this.elements.appContainer);
            this.uiManager.initResizablePanels();
            // 显示返回按钮
            this.elements.backToIdentityBtn.style.display = 'flex';
        });
    }

    // 学生身份选择
    initStudentButton() {
        this.elements.studentBtn.addEventListener('click', () => {
            this.uiManager.transitionToScreen(this.elements.studentIdScreen);
            this.elements.studentIdEntryInput.focus();
        });
    }

    // 学号输入相关事件
    initStudentIdEntry() {
        // 取消按钮
        this.elements.studentIdCancelBtn.addEventListener('click', () => {
            this.uiManager.transitionToScreen(this.elements.identityScreen);
        });

        // 提交按钮
        this.elements.studentIdSubmitBtn.addEventListener('click', () => {
            const id = this.elements.studentIdEntryInput.value.trim();
            if (!/^\d+$/.test(id)) {
                this.uiManager.displayNotification('学号必须是纯数字', 'error');
                return;
            }
            
            this.appState.setStudentId(id);
            this.appState.setUserRole('student');
            
            this.elements.studentIdEntryInput.value = '';

            this.uiManager.setupMainApp();
            this.uiManager.transitionToScreen(this.elements.appContainer);
            this.uiManager.initResizablePanels();
            this.elements.backToIdentityBtn.style.display = 'flex';
            
            // 确保学生视图中的学号输入框也同步更新
            this.syncStudentIdInput();
        });
    }

    // 返回按钮事件处理
    initBackButton() {
        this.elements.backToIdentityBtn.addEventListener('click', () => {
            const userRole = this.appState.getUserRole();
            
            // 重置状态
            this.appState.reset();
            
            // 重置所有视图和状态
            this.resetTeacherView();
            this.resetStudentView();
            
            this.elements.backToIdentityBtn.style.display = 'none';
            
            // 无论是学生端还是教师端，都刷新页面
            this.uiManager.displayNotification('正在刷新页面...', 'info');
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
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

    // 同步学号输入框
    syncStudentIdInput() {
        const studentId = this.appState.getStudentId();
        if (studentId && this.elements.studentIdInput) {
            this.elements.studentIdInput.value = studentId;
        }
    }

    // 初始化学号输入框同步
    initStudentIdInputSync() {
        // 监听学生视图中的学号输入框变化
        if (this.elements.studentIdInput) {
            this.elements.studentIdInput.addEventListener('input', (e) => {
                const newId = e.target.value.trim();
                if (/^\d*$/.test(newId)) { // 允许空字符串或纯数字
                    this.appState.setStudentId(newId);
                }
            });

            this.elements.studentIdInput.addEventListener('blur', (e) => {
                const newId = e.target.value.trim();
                if (!/^\d+$/.test(newId)) {
                    this.uiManager.displayNotification('学号必须是纯数字', 'error');
                    e.target.value = this.appState.getStudentId() || '';
                } else {
                    // 学号有效时，重新加载当前题目的提交记录
                    const activeProblem = this.appState.getActiveProblem();
                    if (activeProblem && this.appState.getUserRole() === 'student') {
                        // 获取学生视图实例
                        const studentView = this.uiManager.studentView;
                        if (studentView && studentView.loadLatestStudentSubmission) {
                            studentView.loadLatestStudentSubmission(activeProblem.id, newId);
                        }
                    }
                }
            });
        }
    }
}