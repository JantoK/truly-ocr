# 使用 Node.js 官方提供的 Node 镜像作为基础镜像
FROM mcr.microsoft.com/windows/servercore:ltsc2022

# 设置工作目录
WORKDIR /usr/src/app

# 将项目文件复制到工作目录
COPY . .

# 安装项目依赖
RUN yarn install

# 暴露项目运行的端口
EXPOSE 3000

# 定义启动命令
CMD ["npm", "start"]