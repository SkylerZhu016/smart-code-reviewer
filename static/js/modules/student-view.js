// 学生视图模块 - 负责学生特有的功能，如恢复上次提交等
export class StudentView {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
    }

    init() {
        // 初始化时不需要特殊操作
    }

    // 重置学生视图
    resetStudentView() {
        const codeEditor = this.appState.getCodeEditor();
        if (codeEditor) {
            // 确保编辑器是可编辑的，并设置初始代码
            codeEditor.setValue('# 请在此输入你的代码...');
            codeEditor.updateOptions({
                readOnly: false,
                // 确保编辑器完全初始化
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                lineNumbers: 'on'
            });
            // 聚焦到编辑器
            codeEditor.focus();
            // 将光标移动到代码末尾
            codeEditor.setPosition({ lineNumber: 1, column: 1 });
        }
        this.elements.testTab.innerHTML = '';
        this.elements.aiTab.innerHTML = '';
        this.elements.runTab.innerHTML = '';
        this.elements.chatDisplay.innerHTML = '<div class="chat-message ai-message"><p>你好，我是你的AI编程导师。有任何关于代码的问题都可以问我！</p></div>';
        
        // 重置当前提交ID
        this.appState.setCurrentSubmissionId(null);
    }

    // 加载学生最新的提交记录
    async loadLatestStudentSubmission(problemId, studentId) {
        // 确保学号不为空且是有效的
        if (!studentId || !/^\d+$/.test(studentId)) {
            console.warn('学号无效或为空，使用默认初始化');
            this.resetStudentView();
            this.uiManager.displayNotification('请输入有效的学号', 'error');
            return;
        }

        this.uiManager.showGlobalLoadingModal('正在恢复你上次的进度...');
        try {
            // 等待编辑器初始化完成
            const editorManager = this.appState.getEditorManager ? this.appState.getEditorManager() : null;
            if (editorManager && typeof editorManager.waitForEditorInitialization === 'function') {
                const isEditorReady = await editorManager.waitForEditorInitialization();
                if (!isEditorReady) {
                    console.warn('编辑器初始化超时，继续执行操作');
                }
            }

            // 确保URL格式正确，去除可能的额外字符
            const cleanStudentId = studentId.toString().trim();
            const response = await fetch(`/api/student/latest-submission/${problemId}/${cleanStudentId}`);
            
            if (!response.ok) {
                // 处理HTTP错误
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.status === 'not_found') {
                // 没有找到提交记录，正常初始化
                this.resetStudentView();
                this.uiManager.displayNotification('欢迎开始新的挑战！', 'info');
                return;
            }
            if (result.status === 'success') {
                const submission = result.data;
                this.appState.setCurrentSubmissionId(submission.id);
                
                const codeEditor = this.appState.getCodeEditor();
                if (codeEditor) {
                    codeEditor.setValue(submission.code);
                    codeEditor.updateOptions({ readOnly: false });
                } else {
                    console.error('编辑器未初始化，无法设置代码');
                    this.uiManager.displayNotification('编辑器未初始化，请刷新页面重试', 'error');
                    return;
                }
                
                this.uiManager.displayTestResult({ details: submission.test_details });
                
                // 加载学生AI辅导历史记录
                await this.loadStudentAIReviewHistory(problemId, cleanStudentId);
                
                document.querySelector('.tab-button[data-tab="test"]').click();
            } else {
                // 处理后端返回的非success状态
                this.resetStudentView();
                this.uiManager.displayNotification(result.message || '恢复进度失败', 'error');
            }
        } catch (error) {
            console.error('恢复进度失败:', error);
            this.resetStudentView(); // 加载失败则重置视图
            this.uiManager.displayNotification('无法连接到服务器或恢复进度失败', 'error');
        } finally {
            this.uiManager.hideGlobalLoadingModal();
        }
    }

    // 加载学生AI辅导历史记录
    async loadStudentAIReviewHistory(problemId, studentId) {
        try {
            const response = await fetch(`/api/student/review-history/${problemId}/${studentId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.status === 'success' && result.data && result.data.length > 0) {
                // 获取最新的AI辅导记录
                const latestReview = result.data[0];
                
                // 使用UI管理器渲染AI辅导内容
                this.uiManager.renderAiReview(latestReview.review_data);
                this.uiManager.displayNotification('已成功恢复你上次的代码和AI辅导记录', 'success');
            } else {
                // 没有AI辅导记录，尝试从本地存储加载
                this.loadAIReviewFromLocalStorage(problemId, studentId);
            }
        } catch (error) {
            console.error('加载AI辅导历史失败:', error);
            // 尝试从本地存储加载
            this.loadAIReviewFromLocalStorage(problemId, studentId);
        }
    }

    // 从本地存储加载AI辅导内容
    loadAIReviewFromLocalStorage(problemId, studentId) {
        try {
            const key = `ai_review_${problemId}_${studentId}`;
            const data = localStorage.getItem(key);
            if (data) {
                const reviewData = JSON.parse(data);
                // 使用UI管理器渲染AI辅导内容
                this.uiManager.renderAiReview(reviewData.reviewData);
                this.uiManager.displayNotification('已从本地缓存恢复AI辅导记录', 'info');
            } else {
                // 没有本地缓存
                this.elements.aiTab.innerHTML = '<p>你上次的提交还没有AI辅导记录，可以点击按钮生成。</p>';
                this.uiManager.displayNotification('已成功恢复你上次的代码', 'success');
            }
        } catch (error) {
            console.error('从本地存储加载AI辅导内容失败:', error);
            this.elements.aiTab.innerHTML = '<p>加载AI辅导记录失败，可以点击按钮重新生成。</p>';
        }
    }
}