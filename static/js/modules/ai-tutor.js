// AI辅导模块 - 负责AI评审和问答功能
export class AiTutor {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
    }

    init() {
        this.initAiReviewButton();
        this.initSendButton();
    }

    // 初始化AI辅导按钮
    initAiReviewButton() {
        this.elements.aiReviewBtn.addEventListener('click', async () => {
            await this.handleAiReview();
        });
    }

    // 初始化发送按钮
    initSendButton() {
        this.elements.sendBtn.addEventListener('click', async () => {
            await this.handleSendMessage();
        });
    }

    // 处理AI辅导请求
    async handleAiReview() {
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

        let code = codeEditor.getValue();
        if (!this.isValidCode(code)) {
            this.uiManager.displayNotification('代码无效，无法获取AI辅导', 'error');
            return;
        }

        this.uiManager.showGlobalLoadingModal('正在获取AI辅导...');
        try {
            const userRole = this.appState.getUserRole();
            let requestBody = {
                role: userRole,
                problem_id: activeProblem.id,
                code,
                userInput: '请分析这个学生代码并提供改进建议'
            };

            // 根据用户角色处理不同的请求参数
            if (userRole === 'teacher') {
                // 教师端需要submission_id
                const currentSubmissionId = this.appState.getCurrentSubmissionId();
                if (!currentSubmissionId) {
                    this.uiManager.displayNotification('请先选择一个学生提交记录', 'error');
                    return;
                }
                requestBody.submission_id = currentSubmissionId;
            } else {
                // 学生端使用临时生成的submission_id
                requestBody.submission_id = `student_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                requestBody.student_id = this.appState.getStudentId();
            }

            const response = await fetch('/api/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: this.appState.getAbortController()?.signal
            });

            if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // 使用Markdown渲染
                this.renderMarkdownAiReview(data.data);
                
                // 只有学生端才保存到本地存储作为备份（教师端使用服务器缓存）
                if (userRole === 'student') {
                    this.saveAIReviewToLocalStorage(activeProblem.id, this.appState.getStudentId(), data.data);
                }
                
                this.uiManager.displayNotification('AI辅导完成', 'success');
                document.querySelector('.tab-button[data-tab="ai"]').click();
            } else {
                this.elements.aiTab.innerHTML = `
                    <h4>AI 辅导失败</h4>
                    <div style="color: red; padding: 15px; background-color: #ffe6e6; border-radius: 5px;">
                        <p><strong>错误信息：</strong> ${this.escapeHtml(data.message || '未知错误')}</p>
                    </div>
                `;
                this.uiManager.displayNotification(`AI辅导失败: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('AI辅导请求失败:', error);
            if (error.name !== 'AbortError') {
                this.elements.aiTab.innerHTML = `
                    <h4>请求失败</h4>
                    <div style="color: red; padding: 15px; background-color: #ffe6e6; border-radius: 5px;">
                        <p><strong>错误信息：</strong> ${this.escapeHtml(error.message || '网络错误')}</p>
                    </div>
                `;
                this.uiManager.displayNotification(`AI辅导失败: ${error.message}`, 'error');
            }
        } finally {
            this.uiManager.hideGlobalLoadingModal();
        }
    }

    // 使用Markdown渲染AI辅导内容
    renderMarkdownAiReview(reviewData) {
        const userRole = this.appState.getUserRole();
        
        // 调试信息
        console.log('renderMarkdownAiReview - userRole:', userRole);
        console.log('renderMarkdownAiReview - reviewData:', reviewData);

        // 检查数据有效性
        if (!reviewData || typeof reviewData !== 'object') {
            this.elements.aiTab.innerHTML = `<p>未收到有效的AI评估结果。</p>`;
            return;
        }

        // 根据用户角色使用不同的渲染方法
        if (userRole === 'teacher') {
            this.renderTeacherFormat(reviewData);
        } else {
            this.renderStudentFormat(reviewData);
        }
    }

    // 教师端专用渲染方法
    renderTeacherFormat(reviewData) {
        let html = `<h4>AI 辅导结果</h4>`;

        // 总体评价
        if (reviewData.general_comment) {
            html += `
                <div class="ai-review-section">
                    <h5>总体评价</h5>
                    <p>${this.escapeHtml(reviewData.general_comment)}</p>
                </div>
            `;
        }

        // 代码优点
        if (reviewData.strengths && reviewData.strengths.length > 0) {
            html += `
                <div class="ai-review-section">
                    <h5>代码优点</h5>
                    <ul>
            `;
            reviewData.strengths.forEach(strength => {
                if (typeof strength === 'string') {
                    html += `<li>${this.escapeHtml(strength)}</li>`;
                } else if (typeof strength === 'object' && strength.comment) {
                    html += `<li>${this.escapeHtml(strength.comment)}</li>`;
                }
            });
            html += `
                    </ul>
                </div>
            `;
        }

        // 改进建议
        if (reviewData.areas_for_improvement && reviewData.areas_for_improvement.length > 0) {
            html += `
                <div class="ai-review-section">
                    <h5>改进建议</h5>
                    <ul>
            `;
            reviewData.areas_for_improvement.forEach(area => {
                if (typeof area === 'string') {
                    html += `<li>${this.escapeHtml(area)}</li>`;
                } else if (typeof area === 'object' && area.comment) {
                    html += `<li>${this.escapeHtml(area.comment)}</li>`;
                }
            });
            html += `
                    </ul>
                </div>
            `;
        }

        // 评分
        if (reviewData.total_score !== undefined) {
            html += `
                <div class="ai-review-section">
                    <h5>评分</h5>
                    <p>总分: ${reviewData.total_score}</p>
                </div>
            `;
        }

        // 优化后代码
        if (reviewData.optimized_code) {
            html += `
                <div class="ai-review-section">
                    <h5>优化后代码</h5>
                    <pre><code>${this.escapeHtml(reviewData.optimized_code)}</code></pre>
                </div>
            `;
        }

        // 优化说明
        if (reviewData.explanation_of_optimization) {
            html += `
                <div class="ai-review-section">
                    <h5>优化说明</h5>
                    <p>${this.escapeHtml(reviewData.explanation_of_optimization)}</p>
                </div>
            `;
        }

        // 查看原始数据
        html += `
            <details style="margin-top: 20px;">
                <summary style="cursor: pointer; color: #6c757d; font-size: 12px;">查看原始数据</summary>
                <pre style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px; margin-top: 10px;">${this.escapeHtml(JSON.stringify(reviewData, null, 2))}</pre>
            </details>
        `;

        this.elements.aiTab.innerHTML = html;
    }

    // 学生端专用渲染方法
    renderStudentFormat(reviewData) {
        let html = `<h4>AI 辅导结果</h4>`;

        // 解释
        if (reviewData.explanation) {
            html += `
                <div class="ai-review-section">
                    <h5>解释</h5>
                    <p>${this.escapeHtml(reviewData.explanation)}</p>
                </div>
            `;
        }

        // 提示
        if (reviewData.hint_or_snippet && reviewData.hint_or_snippet.trim()) {
            html += `
                <div class="ai-review-section">
                    <h5>提示</h5>
                    <p>${this.escapeHtml(reviewData.hint_or_snippet)}</p>
                </div>
            `;
        }

        // 下一步思考
        if (reviewData.next_step_question && reviewData.next_step_question.trim()) {
            html += `
                <div class="ai-review-section">
                    <h5>下一步思考</h5>
                    <p>${this.escapeHtml(reviewData.next_step_question)}</p>
                </div>
            `;
        }

        // 查看原始数据
        html += `
            <details style="margin-top: 20px;">
                <summary style="cursor: pointer; color: #6c757d; font-size: 12px;">查看原始数据</summary>
                <pre style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px; margin-top: 10px;">${this.escapeHtml(JSON.stringify(reviewData, null, 2))}</pre>
            </details>
        `;

        this.elements.aiTab.innerHTML = html;
    }

    // 简单的Markdown渲染备用方案
    simpleMarkdownRender(text) {
        return text
            // 标题
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // 粗体
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // 斜体
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // 行内代码
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // 代码块
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // 段落
            .replace(/\n\n/g, '</p><p>')
            // 首尾段落标签
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            // 换行
            .replace(/\n/g, '<br>');
    }

    // HTML转义方法
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 处理发送消息请求
    async handleSendMessage() {
        const activeProblem = this.appState.getActiveProblem();
        if (!activeProblem) { 
            this.uiManager.displayNotification('请先选择一个题目', 'error'); 
            return; 
        }
        
        const question = this.elements.mainInput.value.trim();
        if (!question) {
            this.uiManager.displayNotification('请输入问题', 'error');
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
        
        this.elements.chatDisplay.innerHTML += `<div class="chat-message user-message"><p>${this.escapeHtml(question)}</p></div>`;
        this.elements.mainInput.value = '';
        this.elements.mainInput.focus();

        // 显示加载中的消息
        const loadingMessageId = `loading-${Date.now()}`;
        this.elements.chatDisplay.innerHTML += `
            <div class="chat-message ai-message" id="${loadingMessageId}">
                <div class="ai-message-content">
                    <div class="ai-message-section">
                        <strong>AI正在思考中...</strong>
                        <p>请稍候，正在生成回答...</p>
                    </div>
                </div>
            </div>
        `;
        this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;

        this.uiManager.showGlobalLoadingModal('正在获取回答...');
        try {
            // 确保学生ID存在且有效
            const studentId = this.appState.getStudentId();
            if (!studentId || !/^\d+$/.test(studentId)) {
                this.uiManager.displayNotification('学号无效，请重新输入学号', 'error');
                this.uiManager.hideGlobalLoadingModal();
                return;
            }

            // 为学生提问生成一个唯一的submission_id，避免缓存
            const uniqueSubmissionId = `student_question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const response = await fetch('/api/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: 'student',
                    problem_id: activeProblem.id,
                    submission_id: uniqueSubmissionId,
                    student_id: studentId, // 确保学生ID正确传递
                    code,
                    userInput: question
                }),
                signal: this.appState.getAbortController()?.signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const data = await response.json();
            this.uiManager.hideGlobalLoadingModal();
            
            // 移除加载中的消息
            const loadingElement = document.getElementById(loadingMessageId);
            if (loadingElement) {
                loadingElement.remove();
            }
            
            if (data.status === 'success') {
                // 构建Markdown内容
                let markdownContent = '';
                
                if (typeof data.data === 'string') {
                    // 如果是字符串，直接显示
                    markdownContent = data.data;
                } else if (typeof data.data === 'object') {
                    // 如果是对象，尝试提取有用信息
                    if (data.data.explanation) {
                        markdownContent += `## 解释\n\n${data.data.explanation}\n\n`;
                    }
                    if (data.data.hint_or_snippet) {
                        markdownContent += `## 提示\n\n\`\`\`\n${data.data.hint_or_snippet}\n\`\`\`\n\n`;
                    }
                    if (data.data.next_step_question) {
                        markdownContent += `## 下一步思考\n\n${data.data.next_step_question}`;
                    }
                    
                    // 处理教师端格式的数据（如果学生端收到了教师端的数据格式）
                    if (data.data.general_comment) {
                        markdownContent += `## 总体评价\n\n${data.data.general_comment}\n\n`;
                    }
                    if (data.data.strengths && data.data.strengths.length > 0) {
                        markdownContent += `## 代码优点\n\n`;
                        data.data.strengths.forEach(strength => {
                            if (typeof strength === 'object' && strength.comment) {
                                markdownContent += `- ${strength.comment}\n`;
                            } else if (typeof strength === 'string') {
                                markdownContent += `- ${strength}\n`;
                            } else {
                                markdownContent += `- ${JSON.stringify(strength)}\n`;
                            }
                        });
                        markdownContent += '\n';
                    }
                    if (data.data.areas_for_improvement && data.data.areas_for_improvement.length > 0) {
                        markdownContent += `## 改进建议\n\n`;
                        data.data.areas_for_improvement.forEach(area => {
                            if (typeof area === 'object' && area.comment) {
                                markdownContent += `- ${area.comment}\n`;
                            } else if (typeof area === 'string') {
                                markdownContent += `- ${area}\n`;
                            } else {
                                markdownContent += `- ${JSON.stringify(area)}\n`;
                            }
                        });
                        markdownContent += '\n';
                    }
                    if (data.data.total_score !== undefined) {
                        markdownContent += `## 评分\n\n总分: ${data.data.total_score}\n\n`;
                    }
                    // 如果以上都没有，显示原始响应
                    if (!markdownContent && data.data.raw_response) {
                        markdownContent = data.data.raw_response;
                    }
                }
                
                // 如果还是没有内容，使用通用消息
                if (!markdownContent) {
                    markdownContent = 'AI已收到您的问题，但返回的格式无法解析。请尝试重新提问。';
                }
                
                // 使用marked库渲染Markdown
                let renderedContent = '';
                try {
                    if (typeof marked !== 'undefined') {
                        // 配置marked选项
                        marked.setOptions({
                            breaks: true,  // 支持换行
                            gfm: true,     // 支持GitHub风格Markdown
                            sanitize: false // 允许HTML（因为我们已经转义了）
                        });
                        renderedContent = marked.parse(markdownContent);
                    } else {
                        // 备用方案：简单的Markdown渲染
                        renderedContent = this.simpleMarkdownRender(markdownContent);
                    }
                } catch (e) {
                    console.error('Markdown渲染失败:', e);
                    renderedContent = `<pre style="white-space: pre-wrap;">${this.escapeHtml(markdownContent)}</pre>`;
                }
                
                // 创建AI消息气泡
                const aiHtml = `<div class="chat-message ai-message">
                    <div class="ai-message-content">
                        <div class="ai-message-section markdown-content">
                            ${renderedContent}
                        </div>
                    </div>
                </div>`;
                
                this.elements.chatDisplay.innerHTML += aiHtml;
                this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
            } else {
                // 显示错误消息
                const errorHtml = `<div class="chat-message ai-message">
                    <div class="ai-message-content">
                        <div class="ai-message-section" style="color: red;">
                            <strong>错误：</strong>
                            <p>${this.escapeHtml(data.message || '请求失败')}</p>
                        </div>
                    </div>
                </div>`;
                this.elements.chatDisplay.innerHTML += errorHtml;
                this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
                this.uiManager.displayNotification(`提问失败: ${data.message}`, 'error');
            }
        } catch (error) {
            this.uiManager.hideGlobalLoadingModal();
            
            // 移除加载中的消息
            const loadingElement = document.getElementById(loadingMessageId);
            if (loadingElement) {
                loadingElement.remove();
            }
            
            if (error.name !== 'AbortError') {
                // 显示错误消息
                const errorHtml = `<div class="chat-message ai-message">
                    <div class="ai-message-content">
                        <div class="ai-message-section" style="color: red;">
                            <strong>网络错误：</strong>
                            <p>${this.escapeHtml(error.message || '网络连接失败')}</p>
                        </div>
                    </div>
                </div>`;
                this.elements.chatDisplay.innerHTML += errorHtml;
                this.elements.chatDisplay.scrollTop = this.elements.chatDisplay.scrollHeight;
                this.uiManager.displayNotification(`提问失败: ${error.message}`, 'error');
            }
        }
    }

    // 添加HTML转义方法
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    // 保存AI辅导内容到本地存储作为备份
    saveAIReviewToLocalStorage(problemId, studentId, reviewData) {
        try {
            const key = `ai_review_${problemId}_${studentId}`;
            const data = {
                problemId,
                studentId,
                reviewData,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log('AI辅导内容已保存到本地存储');
        } catch (error) {
            console.error('保存AI辅导内容到本地存储失败:', error);
        }
    }

    // 从本地存储加载AI辅导内容
    loadAIReviewFromLocalStorage(problemId, studentId) {
        try {
            const key = `ai_review_${problemId}_${studentId}`;
            const data = localStorage.getItem(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('从本地存储加载AI辅导内容失败:', error);
            return null;
        }
    }
}