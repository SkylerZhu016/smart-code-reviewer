// UI管理器模块 - 负责页面切换、通知显示等UI交互
export class UIManager {
    constructor(elements, appState) {
        this.elements = elements;
        this.appState = appState;
    }

    init() {
        this.initResizablePanels();
        this.initTabSwitching();
        this.initCancelReviewButton();
    }

    // 页面切换动画
    transitionToScreen(targetScreen) {
        this.elements.transitionOverlay.classList.add('visible');
        setTimeout(() => {
            document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
            targetScreen.classList.remove('hidden');
            setTimeout(() => {
                this.elements.transitionOverlay.classList.remove('visible');
            }, 300);
        }, 500);
    }

    // 初始化可调整大小的面板
    initResizablePanels() {
        const leftPanel = document.getElementById('left-panel');
        const mainPanel = document.getElementById('main-panel');
        const rightPanel = document.getElementById('right-panel');
        const dividerLeft = document.getElementById('divider-left');
        const dividerRight = document.getElementById('divider-right');
        
        let isResizingLeft = false;
        let isResizingRight = false;
    
        dividerLeft.addEventListener('mousedown', (e) => {
            isResizingLeft = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    
        dividerRight.addEventListener('mousedown', (e) => {
            isResizingRight = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    
        document.addEventListener('mousemove', (e) => {
            if (!isResizingLeft && !isResizingRight) return;
            const containerRect = this.elements.appContainer.getBoundingClientRect();
            const minWidth = 150;
    
            if (isResizingLeft) {
                const newLeftWidth = e.clientX - containerRect.left;
                if (newLeftWidth > minWidth && (containerRect.width - newLeftWidth - rightPanel.offsetWidth) > minWidth) {
                    leftPanel.style.flex = `0 0 ${newLeftWidth}px`;
                }
            } else if (isResizingRight) {
                const newRightWidth = containerRect.right - e.clientX;
                 if (newRightWidth > minWidth && (containerRect.width - leftPanel.offsetWidth - newRightWidth) > minWidth) {
                    rightPanel.style.flex = `0 0 ${newRightWidth}px`;
                }
            }
        });
    
        document.addEventListener('mouseup', () => {
            isResizingLeft = false;
            isResizingRight = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        });
    }

    // 标签页切换功能
    initTabSwitching() {
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.getAttribute('data-tab');
                this.elements.tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(`${tab}-tab`).classList.add('active');
            });
        });
    }

    // 显示全局加载模态框
    showGlobalLoadingModal(text) {
        this.appState.setAbortController(new AbortController());
        this.elements.loadingStatusText.textContent = text;
        this.elements.globalLoadingOverlay.classList.remove('hidden');
    }

    // 隐藏全局加载模态框
    hideGlobalLoadingModal() {
        this.elements.globalLoadingOverlay.classList.add('hidden');
        this.appState.setAbortController(null);
    }

    // 取消操作按钮事件
    initCancelReviewButton() {
        this.elements.cancelReviewBtn.addEventListener('click', () => {
            const abortController = this.appState.getAbortController();
            if (abortController) {
                abortController.abort();
                this.hideGlobalLoadingModal();
                this.displayNotification('操作已取消', 'info');
            }
        });
    }

    // 显示通知消息
    displayNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    // 根据用户角色设置主应用界面
    setupMainApp() {
        const userRole = this.appState.getUserRole();
        const studentId = this.appState.getStudentId();
        
        if (userRole === 'teacher') {
            // 教师端显示"重新登录"按钮
            this.elements.backToIdentityBtn.textContent = '重新登录';
            
            this.elements.addProblemBtn.classList.remove('hidden');
            this.elements.teacherView.classList.remove('hidden');
            this.elements.studentView.classList.add('hidden');
            this.elements.codeButtons.classList.remove('hidden');
            this.elements.gradingTabBtn.classList.remove('hidden');
            this.elements.submitBtn.classList.add('hidden'); // 教师端没有提交按钮
            this.elements.runTestBtn.classList.remove('hidden'); // 教师端可以测试代码
            this.elements.exportCurrentBtn.classList.remove('hidden');
            this.elements.exportAllBtn.classList.remove('hidden');
        } else { // 学生视图
            // 学生端显示"重新登录"按钮
            this.elements.backToIdentityBtn.textContent = '重新登录';
            
            this.elements.addProblemBtn.classList.add('hidden');
            this.elements.teacherView.classList.add('hidden');
            this.elements.studentView.classList.remove('hidden');
            this.elements.codeButtons.classList.remove('hidden');
            this.elements.gradingTabBtn.classList.add('hidden');
            this.elements.runTestBtn.classList.remove('hidden'); // 学生端可以自测
            this.elements.submitBtn.classList.remove('hidden'); // 学生端有提交按钮
            this.elements.studentIdInput.value = studentId; // 设置并禁用学号输入框
            this.elements.studentIdInput.readOnly = true;
            // 隐藏学生端的导出按钮
            this.elements.exportCurrentBtn.classList.add('hidden');
            this.elements.exportAllBtn.classList.add('hidden');
        }
    }

    // 显示测试结果
    displayTestResult(testData) {
        this.elements.testTab.innerHTML = '';
        if (testData.details) {
            testData.details.forEach((detail, index) => {
                const div = document.createElement('div');
                div.className = `test-case-result ${detail.status}`;
                div.innerHTML = `
                    <h4>测试用例 ${index + 1} - ${detail.status === 'passed' ? '通过' : '失败'}</h4>
                    <p><strong>输入:</strong> <pre>${detail.input}</pre></p>
                    <p><strong>期望输出:</strong> <pre>${detail.expected_output}</pre></p>
                    <p><strong>实际输出:</strong> <pre>${detail.actual_output}</pre></p>
                    ${detail.stderr ? `<p><strong>错误输出:</strong> <pre>${detail.stderr}</pre></p>` : ''}
                `;
                this.elements.testTab.appendChild(div);
            });
        }
    }

    // 渲染AI评审结果
    renderAiReview(reviewData) {
        let html = `<h4>AI 评估报告</h4>`;

        // 检查数据有效性
        if (!reviewData) {
            html += `<p>未收到有效的AI评估结果。</p>`;
            this.elements.aiTab.innerHTML = html;
            return;
        }

        // 如果是字符串，尝试解析为JSON
        if (typeof reviewData === 'string') {
            try {
                reviewData = JSON.parse(reviewData);
            } catch (e) {
                // 解析失败，直接显示原始内容
                html += `<div class="ai-raw-response">
                            <p><strong>AI响应:</strong></p>
                            <pre>${this.escapeHtml(reviewData)}</pre>
                        </div>`;
                this.elements.aiTab.innerHTML = html;
                return;
            }
        }

        // 确保reviewData是对象
        if (typeof reviewData !== 'object' || reviewData === null) {
            html += `<p>AI响应格式异常，无法解析。</p>`;
            this.elements.aiTab.innerHTML = html;
            return;
        }

        // 智能识别数据格式
        if (this.isStudentFormat(reviewData)) {
            // 学生端格式
            this.renderStudentFormat(reviewData, html);
        } else if (this.isTeacherFormat(reviewData)) {
            // 教师端格式
            this.renderTeacherFormat(reviewData, html);
        } else {
            // 未知格式，显示原始数据
            html += `<div class="ai-raw-response">
                        <p><strong>AI响应（未知格式）:</strong></p>
                        <pre>${this.escapeHtml(JSON.stringify(reviewData, null, 2))}</pre>
                    </div>`;
            this.elements.aiTab.innerHTML = html;
        }
    }

    // 判断是否为学生端格式
    isStudentFormat(data) {
        return data.explanation || data.hint_or_snippet || data.next_step_question;
    }

    // 判断是否为教师端格式
    isTeacherFormat(data) {
        return data.general_comment || data.total_score !== undefined || data.strengths || data.areas_for_improvement;
    }

    // 渲染学生端格式
    renderStudentFormat(data, html) {
        let markdownContent = '';

        if (data.explanation) {
            markdownContent += `## 解释\n\n${data.explanation}\n\n`;
        }

        if (data.hint_or_snippet && data.hint_or_snippet.trim()) {
            markdownContent += `## 提示\n\n${data.hint_or_snippet}\n\n`;
        }

        if (data.next_step_question && data.next_step_question.trim()) {
            markdownContent += `## 下一步思考\n\n${data.next_step_question}`;
        }

        if (!markdownContent.trim()) {
            markdownContent = data.raw_response || 'AI辅导已完成，但没有返回具体内容。';
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

        const aiHtml = `<div class="chat-message ai-message">
            <div class="ai-message-content">
                <div class="ai-message-section markdown-content">
                    ${renderedContent}
                </div>
            </div>
        </div>`;

        html += `
            <div style="background-color: rgba(255, 255, 255, 0.7); border: 1px solid rgba(222, 226, 230, 0.8); border-radius: 4px; padding: 15px;">
                ${aiHtml}
            </div>
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

    // 渲染教师端格式
    renderTeacherFormat(data, html) {
        // 总体评价
        if (data.general_comment) {
            html += `<p><strong>总体评价:</strong> ${this.escapeHtml(data.general_comment)}</p>`;
        }

        // 优点
        if (data.strengths && Array.isArray(data.strengths) && data.strengths.length > 0) {
            html += `<h5>优点:</h5><ul>`;
            data.strengths.forEach(s => {
                html += `<li>${this.escapeHtml(s)}</li>`;
            });
            html += `</ul>`;
        }

        // 改进建议
        if (data.areas_for_improvement && Array.isArray(data.areas_for_improvement) && data.areas_for_improvement.length > 0) {
            html += `<h5>改进建议:</h5><ul>`;
            data.areas_for_improvement.forEach(item => {
                const category = this.escapeHtml(item.category || '未知类别');
                const comment = this.escapeHtml(item.comment || '无具体评论');
                const lineRef = this.escapeHtml(item.line_reference || 'N/A');
                html += `<li><strong>${category}</strong> (行: ${lineRef}): ${comment}</li>`;
            });
            html += `</ul>`;
        }

        // 优化后代码
        if (data.optimized_code) {
            html += `<h5>优化后代码参考:</h5><pre><code>${this.escapeHtml(data.optimized_code)}</code></pre>`;
        }

        // 优化说明
        if (data.explanation_of_optimization) {
            html += `<p><strong>优化说明:</strong> ${this.escapeHtml(data.explanation_of_optimization)}</p>`;
        }

        this.elements.aiTab.innerHTML = html;
    }

    // HTML转义方法
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}