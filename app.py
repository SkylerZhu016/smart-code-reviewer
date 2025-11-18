import os
from flask import Flask
from scripts.database import init_db, close_connection
from scripts.routes import register_routes

# 获取项目根目录的绝对路径
project_root = os.path.abspath(os.path.dirname(__file__))

# 创建Flask应用，并明确指定模板和静态文件夹的路径
app = Flask(
    __name__,
    template_folder=os.path.join(project_root, 'templates'),
    static_folder=os.path.join(project_root, 'static'),
    static_url_path='/static'
)

# 注册所有路由
register_routes(app)

# 注册数据库连接关闭处理
app.teardown_appcontext(close_connection)

# 初始化数据库
init_db(app)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
