// 代码运行器模块 - 负责代码执行和测试功能
export class CodeRunner {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
    }

    init() {
        this.initRunTestButton();
        this.initSubmitButton();
    }

    // 初始化自测运行按钮
    initRunTestButton() {
        this.elements.runTestBtn.addEventListener('click', () => {
            this.executeCodeAndShowResult('/api/test', '自测');
        });
    }

    // 初始化提交测试按钮
    initSubmitButton() {
        this.elements.submitBtn.addEventListener('click', () => {
            this.executeCodeAndShowResult('/api/submit', '提交');
        });
    }

    // 辅助函数，用于处理代码执行和测试
    async executeCodeAndShowResult(endpoint, actionName) {
        const activeProblem = this.appState.getActiveProblem();
        if (!activeProblem) { 
            this.uiManager.displayNotification('请先选择一个题目', 'error'); 
            return; 
        }
        
        const codeEditor = this.appState.getCodeEditor();
        if (!codeEditor) {
            this.uiManager.displayNotification('代码编辑器未初始化', 'error');
            return;
        }
        
        const code = codeEditor.getValue();
        if (!this.isValidCode(code)) {
            this.uiManager.displayNotification('请先输入有效的Python代码，而不是占位符文本', 'error');
            return;
        }
        
        let studentId = null;
        const userRole = this.appState.getUserRole();
        if (userRole === 'student') {
            studentId = this.elements.studentIdInput?.value?.trim();
            if (!studentId) {
                this.uiManager.displayNotification('请输入学号', 'error');
                return;
            }
            if (!/^\d+$/.test(studentId)) {
                this.uiManager.displayNotification('学号必须是数字', 'error');
                return;
            }
        }
        
        this.uiManager.showGlobalLoadingModal(`正在${actionName}...`);
        try {
            const requestBody = { code };
            if (studentId) {
                requestBody.student_id = studentId;
            }
            
            const response = await fetch(`${endpoint}/${activeProblem.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: this.appState.getAbortController()?.signal
            });
            
            if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.uiManager.displayTestResult(data.data);
                this.uiManager.displayNotification(`${actionName}完成: 通过 ${data.data.passed}/${data.data.total} 个测试用例`, 'info');
                document.querySelector('.tab-button[data-tab="test"]').click();
                
                if (data.submission_id) {
                    this.appState.setCurrentSubmissionId(data.submission_id);
                    this.uiManager.displayNotification('代码已成功提交！现在可以获取AI辅导或进行提问。', 'success');
                }
            } else {
                this.uiManager.displayNotification(`${actionName}失败: ${data.message}`, 'error');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.uiManager.displayNotification(`${actionName}失败: ${error.message}`, 'error');
            }
        } finally {
            this.uiManager.hideGlobalLoadingModal();
        }
    }

    // 辅助函数，用于验证代码是否有效
    isValidCode(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }
        
        const trimmedCode = code.trim();
        if (!trimmedCode) {
            return false;
        }
        
        // 检查是否为无效的占位符文本
        const invalidPatterns = [
            '# 请从左侧选择一个题目',
            '# 请在此输入你的代码',
            '# 请输入代码',
            '# 教师视图',
            '# 可以在此粘贴学生代码进行测试或获取AI分析',
            '请将您需要评审的Python代码发给我',
            '请输入你的代码',
            '# 请从左侧选择一个题目...',
            '# 请在此输入你的代码...'
        ];
        
        const codeLower = trimmedCode.toLowerCase();
        for (const pattern of invalidPatterns) {
            if (codeLower.includes(pattern.toLowerCase())) {
                return false;
            }
        }
        
        // 检查代码是否包含至少一个有效的Python语句
        // 移除注释和空行后检查是否还有代码
        const codeWithoutComments = trimmedCode.replace(/#.*$/gm, '').trim();
        const codeWithoutEmptyLines = codeWithoutComments.replace(/\n\s*\n/g, '\n').trim();
        
        return codeWithoutEmptyLines.length > 0;
    }
}