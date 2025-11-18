// 提交管理器模块 - 负责学生提交记录的管理和显示
export class SubmissionManager {
    constructor(elements, appState, uiManager) {
        this.elements = elements;
        this.appState = appState;
        this.uiManager = uiManager;
        this.aiTutor = null; // 将在main.js中设置
    }

    init() {
        // 初始化时不需要特殊操作，等待ProblemManager调用
    }

    // 加载题目的提交记录
    async loadSubmissionsForProblem(problemId) {
        const activeProblem = this.appState.getActiveProblem();
        if (!activeProblem) return;
        
        this.elements.submissionList.innerHTML = '<li>正在加载提交列表...</li>';
        try {
            const response = await fetch(`/api/submissions/${problemId}`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const submissions = await response.json();
            this.renderSubmissionList(submissions);
        } catch (error) {
            this.elements.submissionList.innerHTML = '<li>加载失败</li>';
            console.error('Load submissions error:', error);
        }
    }

    // 渲染提交列表
    renderSubmissionList(submissions) {
        const userRole = this.appState.getUserRole();
        
        this.elements.submissionList.innerHTML = '';
        if (submissions.length === 0) {
            this.elements.submissionList.innerHTML = '<li>暂无学生提交</li>';
            return;
        }
        
        submissions.forEach(sub => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '8px';
            li.style.borderBottom = '1px solid #dee2e6';
            // 存储学生ID和提交ID到data属性中
            li.setAttribute('data-student-id', sub.student_id || 'anonymous');
            li.setAttribute('data-submission-id', sub.id);
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = sub.display_name;
            nameSpan.style.cursor = 'pointer';
            nameSpan.addEventListener('click', () => {
                // 移除其他项的active类
                document.querySelectorAll('#submission-list li').forEach(li => li.classList.remove('active'));
                // 为当前项添加active类
                li.classList.add('active');
                this.loadSubmissionDetail(sub.id);
            });
            
            li.appendChild(nameSpan);
            
            // 教师端允许删除学生提交记录
            if (userRole === 'teacher') {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.className = 'delete-submission-btn';
                deleteBtn.style.marginLeft = '10px';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除提交记录 "${sub.display_name}" 吗？`)) {
                        this.deleteSubmission(sub.id);
                    }
                };
                li.appendChild(deleteBtn);
            }
            
            this.elements.submissionList.appendChild(li);
        });
    }

    // 加载提交详情
    async loadSubmissionDetail(submissionId) {
        this.uiManager.showGlobalLoadingModal('正在加载提交详情...');
        try {
            const response = await fetch(`/api/submission/${submissionId}`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const detail = await response.json();
            
            this.appState.setCurrentSubmissionId(submissionId);

            const codeEditor = this.appState.getCodeEditor();
            if (codeEditor) {
                codeEditor.setValue(detail.code);
                // 教师视图中，学生代码总是只读
                codeEditor.updateOptions({ readOnly: true });
            }
            
            this.uiManager.displayTestResult({ details: detail.test_details });
            document.querySelector('.tab-button[data-tab="test"]').click();

            // 加载对应的AI评审
            await this.loadAiReviewForSubmission(submissionId);

        } catch (error) {
            console.error('Load submission detail error:', error);
            this.uiManager.displayNotification(`加载提交详情失败: ${error.message}`, 'error');
        } finally {
            this.uiManager.hideGlobalLoadingModal();
        }
    }

    // 根据提交ID加载AI评审
    async loadAiReviewForSubmission(submissionId) {
        try {
            const response = await fetch(`/api/review/${submissionId}`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                // 修复：使用aiTutor的renderMarkdownAiReview方法而不是uiManager的renderAiReview
                // 这样可以确保根据用户角色正确显示格式
                if (this.aiTutor) {
                    this.aiTutor.renderMarkdownAiReview(data.data);
                } else {
                    // 备用方案：如果aiTutor未设置，使用原来的方法
                    this.uiManager.renderAiReview(data.data);
                }
            } else {
                // 如果没有评审数据，显示空白
                this.elements.aiTab.innerHTML = '<p>该提交暂无AI辅导内容。点击"AI辅导"按钮生成。</p>';
            }
        } catch (error) {
            console.error('Load AI review error:', error);
            this.elements.aiTab.innerHTML = '<p>加载AI辅导内容失败。</p>';
        }
    }

    // 设置AiTutor实例的引用
    setAiTutor(aiTutor) {
        this.aiTutor = aiTutor;
    }

    // 删除提交记录
    async deleteSubmission(submissionId) {
        this.uiManager.showGlobalLoadingModal('正在删除提交记录...');
        try {
            const response = await fetch(`/api/submission/${submissionId}`, { method: 'DELETE' });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const data = await response.json();
            this.uiManager.hideGlobalLoadingModal();
            
            if (data.status === 'success') {
                this.uiManager.displayNotification('提交记录删除成功', 'success');
                // 重新加载提交列表
                const activeProblem = this.appState.getActiveProblem();
                if (activeProblem) {
                    this.loadSubmissionsForProblem(activeProblem.id);
                }
            } else {
                this.uiManager.displayNotification(`删除失败: ${data.message}`, 'error');
            }
        } catch (error) {
            this.uiManager.hideGlobalLoadingModal();
            this.uiManager.displayNotification(`删除提交记录失败: ${error.message}`, 'error');
        }
    }
}