// 编辑器管理器模块 - 负责Monaco代码编辑器的初始化和管理
export class EditorManager {
    constructor(elements, appState) {
        this.elements = elements;
        this.appState = appState;
    }

    init() {
        // 延迟初始化编辑器，确保资源加载完成
        setTimeout(() => this.initMonacoEditor(), 1000);
    }

    // 检查编辑器是否已初始化
    isEditorInitialized() {
        return this.appState.getCodeEditor() !== null;
    }

    // 等待编辑器初始化完成
    async waitForEditorInitialization(maxWaitTime = 5000) {
        const startTime = Date.now();
        while (!this.isEditorInitialized() && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return this.isEditorInitialized();
    }

    // 初始化Monaco代码编辑器
    initMonacoEditor() {
        if (typeof require === 'undefined') {
            console.warn('Monaco loader.js 未加载，将使用备用文本区域。');
            this.initFallbackEditor();
            return;
        }
        
        require.config({
            paths: { 'vs': '/static/js/vs' },
            'vs/nls': { availableLanguages: {'*': 'zh-cn'} }
        });

        require(['vs/editor/editor.main'], () => {
            try {
                const codeEditor = monaco.editor.create(document.getElementById('code-editor'), {
                    value: '# 请从左侧选择一个题目...',
                    language: 'python',
                    theme: 'vs-light',
                    automaticLayout: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    folding: true,
                    readOnly: true
                });
                
                this.appState.setCodeEditor(codeEditor);
                console.log("Monaco编辑器成功初始化。");
            } catch (error) {
                console.error('创建Monaco编辑器实例失败:', error);
                this.initFallbackEditor();
            }
        }, (error) => {
            console.error('加载Monaco核心文件失败:', error);
            this.initFallbackEditor();
        });
    }
    
    // 备用文本编辑器
    initFallbackEditor() {
        const codeEditorContainer = document.getElementById('code-editor');
        if (codeEditorContainer) {
            codeEditorContainer.innerHTML = `
                <textarea id="fallback-editor" style="width: 100%; height: 100%; border: 1px solid #DEE2E6; border-radius: 4px; padding: 10px; font-family: 'Courier New', monospace; font-size: 14px; resize: none;" readonly># 请从左侧选择一个题目...</textarea>
            `;
            
            // 创建简单的编辑器接口
            const codeEditor = {
                getValue: () => document.getElementById('fallback-editor').value,
                setValue: (value) => document.getElementById('fallback-editor').value = value,
                updateOptions: (options) => {
                    const editor = document.getElementById('fallback-editor');
                    if (options.readOnly !== undefined) {
                        editor.readOnly = options.readOnly;
                    }
                },
                focus: () => document.getElementById('fallback-editor').focus(),
                setPosition: (position) => {
                    const editor = document.getElementById('fallback-editor');
                    if (editor.setSelectionRange) {
                        // 简单实现：将光标移动到指定行
                        const lines = editor.value.split('\n');
                        let charCount = 0;
                        for (let i = 0; i < Math.min(position.lineNumber - 1, lines.length); i++) {
                            charCount += lines[i].length + 1; // +1 for newline
                        }
                        const finalPosition = Math.min(charCount + (position.column - 1), editor.value.length);
                        editor.setSelectionRange(finalPosition, finalPosition);
                    }
                }
            };
            
            this.appState.setCodeEditor(codeEditor);
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