# 食材研究资料入口

当前本地修订版为 [r5食材参考数据](health-ingredient-reference-r5.json)，入口和哈希见 [current-reference.json](current-reference.json)。

- [数据来源、版本和计量基准](食材数据基准说明.md)
- [r5修订说明与准确统计](ingredient-research-summary-r5.md)
- [修订日志](ingredient-research-change-log-r5.md)
- 逐字段变更与原始响应哈希位于本机 `acceptance-r5/revision-manifest.json`；生成的验收缓存不上传源码仓库。

r1–r4及验收记录保留为历史文件。`health-food-baseline.json`是旧程序的核对清单，其中数值不作为医学依据；`ingredient-research-unverified-candidates-r2.json`中的未验证数字继续隔离。

本目录目前用于研究参考，尚未接入运行中的推荐引擎。通过来源和一致性检查不等于完成临床审核，也不代表全部营养成分齐全。

`build/`内早期装配脚本用于追溯历史，不用它们覆盖当前版本。r5修订入口为 `scripts/revise-ingredient-research-r5.js`，文档由 `scripts/summarize-ingredient-research-r5.js`从实际数据生成；校验为 `scripts/audit-ingredient-research.js --r5`、`scripts/audit-ingredient-research-r3-content.js --r5`及 `scripts/verify-ingredient-research-r5.js`。
