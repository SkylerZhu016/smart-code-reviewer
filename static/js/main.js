// 主入口文件 - 负责初始化应用和协调各个模块
import { AppState } from './modules/app-state.js';
import { UIManager } from './modules/ui-manager.js';
import { AuthManager } from './modules/auth-manager.js';
import { EditorManager } from './modules/editor-manager.js';
import { ProblemManager } from './modules/problem-manager.js';
import { SubmissionManager } from './modules/submission-manager.js';
import { CodeRunner } from './modules/code-runner.js';
import { AiTutor } from './modules/ai-tutor.js';
import { ExportManager } from './modules/export-manager.js';
import { StudentView } from './modules/student-view.js';

window.addEventListener('DOMContentLoaded', () => {
    // 初始化应用状态
    const appState = new AppState();
    
    // 初始化DOM元素引用
    const elements = {
        transitionOverlay: document.getElementById('transition-overlay'),
        identityScreen: document.getElementById('identity-selection-screen'),
        appContainer: document.getElementById('app-container'),
        teacherBtn: document.getElementById('teacher-btn'),
        studentBtn: document.getElementById('student-btn'),
        problemList: document.getElementById('problem-list'),
        teacherView: document.getElementById('teacher-view'),
        studentView: document.getElementById('student-view'),
        addProblemBtn: document.getElementById('add-problem-btn'),
        problemForm: document.getElementById('problem-form'),
        testCaseList: document.getElementById('test-case-list'),
        addTestCaseBtn: document.getElementById('add-test-case-btn'),
        problemDescriptionContent: document.getElementById('problem-description-content'),
        chatDisplay: document.getElementById('chat-display'),
        mainInput: document.getElementById('main-input'),
        sendBtn: document.getElementById('send-btn'),
        // 代码操作按钮
        runTestBtn: document.getElementById('run-test-btn'),
        submitBtn: document.getElementById('submit-btn'),
        aiReviewBtn: document.getElementById('ai-review-btn'),
        // 导出按钮
        exportCurrentBtn: document.getElementById('export-current-btn'),
        exportAllBtn: document.getElementById('export-all-btn'),
        codeButtons: document.getElementById('code-buttons'),
        testTab: document.getElementById('test-tab'),
        aiTab: document.getElementById('ai-tab'),
        runTab: document.getElementById('run-tab'),
        globalLoadingOverlay: document.getElementById('global-loading-overlay'),
        loadingStatusText: document.getElementById('loading-status-text'),
        cancelReviewBtn: document.getElementById('cancel-review-btn'),
        tabButtons: document.querySelectorAll('.tab-button'),
        dividers: document.querySelectorAll('.divider'),
        gradingTabBtn: document.getElementById('grading-tab-btn'),
        gradingTab: document.getElementById('grading-tab'),
        submissionList: document.getElementById('submission-list'),
        // 修复：添加学号输入框引用
        studentIdInput: document.getElementById('student-id-input'),
        backToIdentityBtn: document.getElementById('back-to-identity-btn'),
        // 学号输入屏幕
        studentIdScreen: document.getElementById('student-id-screen'),
        studentIdEntryInput: document.getElementById('student-id-entry-input'),
        studentIdSubmitBtn: document.getElementById('student-id-submit-btn'),
        studentIdCancelBtn: document.getElementById('student-id-cancel-btn')
    };

    // 初始化各个管理器
    const uiManager = new UIManager(elements, appState);
    const authManager = new AuthManager(elements, appState, uiManager);
    const editorManager = new EditorManager(elements, appState);
    const problemManager = new ProblemManager(elements, appState, uiManager);
    const submissionManager = new SubmissionManager(elements, appState, uiManager);
    const codeRunner = new CodeRunner(elements, appState, uiManager);
    const aiTutor = new AiTutor(elements, appState, uiManager);
    const exportManager = new ExportManager(elements, appState, uiManager);
    const studentView = new StudentView(elements, appState, uiManager);

    // 设置模块间的依赖关系
    problemManager.setSubmissionManager(submissionManager);
    problemManager.setStudentView(studentView);
    
    // 设置submissionManager和aiTutor之间的引用关系（修复教师端AI辅导显示格式问题）
    submissionManager.setAiTutor(aiTutor);
    
    // 在应用状态中设置编辑器管理器引用
    appState.setEditorManager(editorManager);
    
    // 在UI管理器中设置学生视图引用，以便其他模块可以访问
    uiManager.studentView = studentView;
    
    authManager.init();
    editorManager.init();
    problemManager.init();
    submissionManager.init();
    codeRunner.init();
    aiTutor.init();
    exportManager.init();
    studentView.init();

    // 初始化UI
    uiManager.init();
});