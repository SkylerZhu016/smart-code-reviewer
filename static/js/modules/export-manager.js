// 导出管理器模块 - 负责PDF报告导出功能
export class ExportManager {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
        this.currentSubmissionCode = null; // 存储当前查看的学生提交代码
    }

    init() {
        this.initExportCurrentButton();
        this.initExportAllButton();
    }

    // 初始化导出当前报告按钮
    initExportCurrentButton() {
        this.elements.exportCurrentBtn.addEventListener('click', () => {
            this.exportCurrentReport();
        });
    }

    // 初始化导出全部报告按钮
    initExportAllButton() {
        this.elements.exportAllBtn.addEventListener('click', () => {
            this.exportAllReports();
        });
    }

    // 导出当前报告
    async exportCurrentReport() {
        const activeProblem = this.appState.getActiveProblem();
        if (!activeProblem) { 
            this.uiManager.displayNotification('请先选择一个题目', 'error'); 
            return; 
        }
        
        // 优先使用存储的学生提交代码，如果没有则使用编辑器中的代码
        let code = this.currentSubmissionCode;
        const codeEditor = this.appState.getCodeEditor();
        if (!code && codeEditor) {
            code = codeEditor.getValue();
        }
        
        if (!this.isValidCode(code)) {
            this.uiManager.displayNotification('请先输入有效的Python代码，而不是占位符文本', 'error');
            return;
        }
        
        // 获取当前学生ID（如果有的话）
        let studentId = null;
        if (this.currentSubmissionCode) {
            // 如果是查看学生提交，尝试从提交列表中获取学生ID
            const activeSubmissionItem = document.querySelector('#submission-list li.active');
            if (activeSubmissionItem) {
                // 使用data属性存储学生ID，避免从显示名称解析
                studentId = activeSubmissionItem.getAttribute('data-student-id');
                if (!studentId) {
                    // 如果没有data属性，尝试从显示名称中提取学生ID (格式: 题目名_学生ID)
                    const displayName = activeSubmissionItem.querySelector('span').textContent;
                    const parts = displayName.split('_');
                    if (parts.length > 1) {
                        studentId = parts.slice(1).join('_');
                    }
                }
            }
        } else {
            // 如果是学生自己提交代码，使用输入的学号
            studentId = this.elements.studentIdInput?.value?.trim();
            if (!studentId) {
                studentId = 'anonymous';
            }
        }
        
        this.uiManager.showGlobalLoadingModal('正在生成PDF报告...');
        try {
            const requestBody = {
                problem_id: activeProblem.id,
                code
            };
            
            // 如果有学生ID，添加到请求中
            if (studentId) {
                requestBody.student_id = studentId;
            }
            
            const response = await fetch('/api/export_pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: this.appState.getAbortController()?.signal
            });
            
            if (!response.ok) {
                throw new Error(`导出失败，服务器返回 ${response.status}`);
            }
            
            const blob = await response.blob();
            this.uiManager.hideGlobalLoadingModal();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `代码批阅报告_${activeProblem.title}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.uiManager.displayNotification('PDF导出成功', 'success');
        } catch (error) {
            this.uiManager.hideGlobalLoadingModal();
            if (error.name !== 'AbortError') {
                this.uiManager.displayNotification(`导出PDF失败: ${error.message}`, 'error');
            }
        }
    }

    // 导出全部报告
    async exportAllReports() {
        const activeProblem = this.appState.getActiveProblem();
        if (!activeProblem) { 
            this.uiManager.displayNotification('请先选择一个题目', 'error'); 
            return; 
        }
        
        this.uiManager.showGlobalLoadingModal('正在获取所有提交记录...');
        try {
            // 获取所有提交记录
            const submissionsResponse = await fetch(`/api/submissions/${activeProblem.id}`);
            if (!submissionsResponse.ok) {
                throw new Error(`获取提交记录失败: ${submissionsResponse.status}`);
            }
            
            const submissions = await submissionsResponse.json();
            if (submissions.length === 0) {
                this.uiManager.hideGlobalLoadingModal();
                this.uiManager.displayNotification('该题目暂无提交记录', 'info');
                return;
            }
            
            this.uiManager.hideGlobalLoadingModal();
            this.uiManager.showGlobalLoadingModal(`正在批量生成 ${submissions.length} 个PDF报告...`);
            
            let successCount = 0;
            let failCount = 0;
            
            // 为每个提交生成PDF
            for (let i = 0; i < submissions.length; i++) {
                const submission = submissions[i];
                try {
                    // 更新加载状态
                    this.elements.loadingStatusText.textContent = `正在生成第 ${i + 1}/${submissions.length} 个PDF报告...`;
                    
                    // 获取提交详情
                    const detailResponse = await fetch(`/api/submission/${submission.id}`);
                    if (!detailResponse.ok) {
                        console.error(`获取提交 ${submission.id} 详情失败`);
                        failCount++;
                        continue;
                    }
                    
                    const detail = await detailResponse.json();
                    
                    // 生成PDF
                    const requestBody = {
                        problem_id: activeProblem.id,
                        code: detail.code
                    };
                    
                    // 添加学生ID到请求中
                    if (submission.student_id) {
                        requestBody.student_id = submission.student_id;
                    }
                    
                    const pdfResponse = await fetch('/api/export_pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                    
                    if (pdfResponse.ok) {
                        const blob = await pdfResponse.blob();
                        
                        // 使用延迟下载避免浏览器阻止多个下载
                        setTimeout(() => {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `代码批阅报告_${submission.display_name}.pdf`;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            
                            // 延迟清理资源
                            setTimeout(() => {
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                            }, 100);
                        }, i * 200); // 每个文件间隔200ms下载
                        
                        successCount++;
                    } else {
                        console.error(`生成PDF失败，状态码: ${pdfResponse.status}`);
                        failCount++;
                    }
                } catch (error) {
                    console.error(`导出提交 ${submission.id} 失败:`, error);
                    failCount++;
                }
            }
            
            this.uiManager.hideGlobalLoadingModal();
            
            if (successCount > 0) {
                this.uiManager.displayNotification(`批量导出完成！成功: ${successCount}，失败: ${failCount}`, 'success');
            } else {
                this.uiManager.displayNotification(`批量导出失败，所有文件都无法生成`, 'error');
            }
        } catch (error) {
            this.uiManager.hideGlobalLoadingModal();
            this.uiManager.displayNotification(`批量导出失败: ${error.message}`, 'error');
        }
    }

    // 设置当前查看的学生提交代码
    setCurrentSubmissionCode(code) {
        this.currentSubmissionCode = code;
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