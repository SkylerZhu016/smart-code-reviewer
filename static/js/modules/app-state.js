// 应用状态管理模块
export class AppState {
    constructor() {
        this.userRole = null;
        this.studentId = null; // 全局存储学生ID
        this.activeProblem = null;
        this.problems = [];
        this.codeEditor = null;
        this.abortController = null;
        this.currentSubmissionId = null; // 存储当前加载或创建的提交ID
        this.editorManager = null; // 编辑器管理器引用
    }

    // 重置所有状态
    reset() {
        this.userRole = null;
        this.studentId = null;
        this.activeProblem = null;
        this.problems = [];
        this.codeEditor = null;
        this.abortController = null;
        this.currentSubmissionId = null;
    }

    // 设置用户角色
    setUserRole(role) {
        this.userRole = role;
    }

    // 获取用户角色
    getUserRole() {
        return this.userRole;
    }

    // 设置学生ID
    setStudentId(id) {
        this.studentId = id;
    }

    // 获取学生ID
    getStudentId() {
        return this.studentId;
    }

    // 设置当前活动题目
    setActiveProblem(problem) {
        this.activeProblem = problem;
    }

    // 获取当前活动题目
    getActiveProblem() {
        return this.activeProblem;
    }

    // 设置题目列表
    setProblems(problems) {
        this.problems = problems;
    }

    // 获取题目列表
    getProblems() {
        return this.problems;
    }

    // 设置代码编辑器
    setCodeEditor(editor) {
        this.codeEditor = editor;
    }

    // 获取代码编辑器
    getCodeEditor() {
        return this.codeEditor;
    }

    // 设置中止控制器
    setAbortController(controller) {
        this.abortController = controller;
    }

    // 获取中止控制器
    getAbortController() {
        return this.abortController;
    }

    // 设置当前提交ID
    setCurrentSubmissionId(id) {
        this.currentSubmissionId = id;
    }

    // 获取当前提交ID
    getCurrentSubmissionId() {
        return this.currentSubmissionId;
    }

    // 设置编辑器管理器引用
    setEditorManager(editorManager) {
        this.editorManager = editorManager;
    }

    // 获取编辑器管理器引用
    getEditorManager() {
        return this.editorManager;
    }
}