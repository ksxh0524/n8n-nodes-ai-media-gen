# 部署检查清单

## 快速验证步骤

### 1. 类型检查
```bash
npm run type-check
```
✅ 预期：无错误输出

### 2. Lint 检查
```bash
npm run lint
```
✅ 预期：无错误，可能有少量 any 类型警告

### 3. 构建项目
```bash
npm run build
```
✅ 预期：构建成功，dist 目录包含所有必要文件

### 4. 验证构建输出
```bash
ls -la dist/nodes/
```
✅ 预期：看到 AIMediaGen.js, AIMediaGen.d.ts, DoubaoGen.js, DoubaoGen.d.ts 等文件

---

## Docker 部署步骤

```bash
cd /Users/liuyang/codes/n8n

# 重启容器
docker-compose restart n8n n8n-worker

# 查看日志
docker-compose logs -f n8n
```

✅ 预期结果：
- 容器成功启动
- n8n 加载自定义节点无错误
- 节点在 n8n UI 中可见

---

## 功能测试清单

### ModelScope API（图生图）
- [ ] 上传输入图片
- [ ] 配置模型参数
- [ ] 提交任务
- [ ] 等待异步任务完成
- [ ] 检查输出图片

### Gemini Nano Banana（文生图）
- [ ] 输入文本提示
- [ ] 选择生成参数
- [ ] 提交任务
- [ ] 检查生成的图片

### Doubao Seedream（文生图/视频）
- [ ] 输入文本提示
- [ ] 选择输出类型（图片/视频）
- [ ] 配置参数
- [ ] 提交任务
- [ ] 检查输出

### 错误处理
- [ ] 测试无效 API Key
- [ ] 测试网络超时
- [ ] 测试无效参数
- [ ] 验证错误消息清晰

---

## 常见问题

### Q: 构建失败怎么办？
A: 检查是否有类型错误，运行 `npm run type-check` 查看详情

### Q: Lint 失败怎么办？
A: 运行 `npm run lint:fix` 自动修复大部分问题

### Q: Docker 容器无法启动？
A: 检查 dist 目录是否存在，运行 `npm run build` 重新构建

---

## 回滚步骤

如果部署后发现问题：

```bash
cd /Users/liuyang/codes/n8n/projets/n8n-service/custom-nodes/n8n-nodes-ai-media-gen

# 回滚到之前的版本
git checkout HEAD~1

# 重新构建
npm run build

# 重启容器
cd /Users/liuyang/codes/n8n
docker-compose restart n8n n8n-worker
```

---

## 联系信息

如有问题，请检查：
1. Docker 容器日志：`docker-compose logs n8n`
2. n8n 日志文件
3. 浏览器控制台错误

**修复详情**: 查看 `FIXES_SUMMARY.md`
