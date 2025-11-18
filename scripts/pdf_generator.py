import os
import io
import signal
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from .config import FONT_PATHS, PDF_GENERATION_TIMEOUT

class PDF(FPDF):
    """自定义PDF生成类，支持中文字体"""
    def __init__(self):
        super().__init__()
        
        # 字体加载状态
        self.font_set = False
        self.chinese_font_set = False
        
        # 加载英文字体
        try:
            self.add_font('NotoSans', '', FONT_PATHS['regular'])
            self.add_font('NotoSans', 'B', FONT_PATHS['bold'])
            self.add_font('NotoSans', 'I', FONT_PATHS['italic'])
            self.add_font('NotoSans', 'BI', FONT_PATHS['bold_italic'])
            self.font_set = True
            print("NotoSans字体加载成功")
        except Exception as e:
            print(f"无法加载NotoSans字体: {e}")
        
        # 加载中文字体
        try:
            self.add_font('SourceHanSans', '', FONT_PATHS['chinese'])
            self.chinese_font_set = True
            print("SourceHanSans中文字体加载成功")
        except Exception as e:
            print(f"无法加载SourceHanSans中文字体: {e}")
    
    def header(self):
        """PDF页眉"""
        if self.chinese_font_set:
            self.set_font('SourceHanSans', '', 15)
        elif self.font_set:
            self.set_font('NotoSans', 'B', 15)
        else:
            self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Intelligent Code Review Report', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(10)

    def footer(self):
        """PDF页脚"""
        self.set_y(-15)
        if self.font_set:
            self.set_font('NotoSans', 'I', 8)
        else:
            self.set_font('Arial', 'I', 8)
        page_text = f'Page {self.page_no()}'
        self.cell(0, 10, page_text, new_x=XPos.RIGHT, new_y=YPos.TOP)

    def chapter_title(self, title):
        """章节标题"""
        if self.chinese_font_set:
            self.set_font('SourceHanSans', '', 12)
        elif self.font_set:
            self.set_font('NotoSans', 'B', 12)
        else:
            self.set_font('Arial', 'B', 12)
        self.cell(0, 10, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

    def chapter_body(self, body):
        """章节正文(英文)"""
        if self.chinese_font_set:
            self.set_font('SourceHanSans', '', 10)
        elif self.font_set:
            self.set_font('NotoSans', '', 10)
        else:
            self.set_font('Arial', '', 10)
        self.multi_cell(0, 5, body)
        self.ln()
    
    def chapter_body_chinese(self, body):
        """章节正文(中文)"""
        if self.chinese_font_set:
            self.set_font('SourceHanSans', '', 10)
            self.multi_cell(0, 5, body)
            self.ln()
        else:
            # 回退到英文显示
            self.chapter_body(body)

def timeout_handler(signum, frame):
    """超时处理函数"""
    raise TimeoutError("PDF生成超时")

def generate_pdf_report(problem, code, test_results, ai_review):
    """生成PDF报告"""
    try:
        # 设置超时处理(Unix系统)
        try:
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(PDF_GENERATION_TIMEOUT)
        except (AttributeError, ValueError):
            # Windows系统不支持
            pass
        
        # 生成PDF
        pdf = PDF()
        pdf.add_page()
        
        # 题目信息
        pdf.chapter_title("Problem Information")
        pdf.chapter_body(f"Title: {problem['title']}")
        pdf.chapter_body(f"Description:\n{problem['description_md']}")
        
        # 学生代码
        pdf.chapter_title("Student Code")
        pdf.chapter_body(code)
        
        # 测试结果
        pdf.chapter_title(f"Test Results ({test_results['passed']}/{test_results['total']} Passed)")
        if test_results.get('details'):
            for detail in test_results['details']:
                pdf.chapter_body(f"Test Case {detail['case']}: {detail['status'].upper()}\n  - Input: {detail['input']}\n  - Expected: {detail['expected_output']}\n  - Actual: {detail['actual_output']}")
        
        # AI评估
        pdf.chapter_title("AI Evaluation")
        
        # 总体评价
        if 'general_comment' in ai_review and ai_review['general_comment']:
            pdf.chapter_body_chinese(f"总体评价:\n{ai_review['general_comment']}")
        
        # 优点
        if 'strengths' in ai_review and ai_review['strengths']:
            pdf.chapter_body_chinese("优点:")
            for strength in ai_review['strengths']:
                pdf.chapter_body_chinese(f"• {strength}")
        
        # 改进建议
        if 'areas_for_improvement' in ai_review and ai_review['areas_for_improvement']:
            pdf.chapter_body_chinese("改进建议:")
            for item in ai_review['areas_for_improvement']:
                category = item.get('category', '未知')
                comment = item.get('comment', '')
                line_ref = item.get('line_reference', '')
                if line_ref:
                    pdf.chapter_body_chinese(f"• [{category}] (行: {line_ref}): {comment}")
                else:
                    pdf.chapter_body_chinese(f"• [{category}]: {comment}")
        
        # 优化后的代码
        if 'optimized_code' in ai_review and ai_review['optimized_code']:
            pdf.chapter_body_chinese("优化后代码参考:")
            pdf.chapter_body(ai_review['optimized_code'])
        
        # 优化说明
        if 'explanation_of_optimization' in ai_review and ai_review['explanation_of_optimization']:
            pdf.chapter_body_chinese("优化说明:")
            pdf.chapter_body_chinese(ai_review['explanation_of_optimization'])
        
        # 生成PDF字节流
        with io.BytesIO() as buffer:
            pdf.output(buffer)
            pdf_bytes = buffer.getvalue()
            buffer.seek(0)
            
            # 取消超时信号
            try:
                signal.alarm(0)
            except (AttributeError, ValueError):
                pass
                
            return pdf_bytes
            
    except TimeoutError as e:
        # 取消超时信号
        try:
            signal.alarm(0)
        except (AttributeError, ValueError):
            pass
        print(f"PDF生成超时: {e}")
        raise e
    except Exception as e:
        # 取消超时信号
        try:
            signal.alarm(0)
        except (AttributeError, ValueError):
            pass
        print(f"PDF生成错误: {e}")
        raise e