# r5 直接修订记录

输入：`health-ingredient-reference-r4.json`。输出：`health-ingredient-reference-r5.json`。日期2026-10-31。

原r1–r4保留；指标值、区间、单位、基准、形态身份、指标来源全部与r4一致。没有填补405项空值，没有更改七目标的assessment标签，没有修改运行时程序。

本轮133个字段变更，分组如下。完整逐字段before/after、原因与输入输出SHA-256保存在`acceptance-r5/revision-manifest.json`，不依赖手抄的完成声明。

| 食材或根层 | 字段变更数 |
| --- | --- |
| meta | 1 |
| milk_lowfat | 4 |
| yogurt_greek | 1 |
| egg_white | 1 |
| oats | 6 |
| seaweed_dried | 2 |
| beer | 3 |
| honey | 4 |
| new_starch | 1 |
| walnut | 3 |
| almond | 3 |
| cheese | 1 |
| sardine | 1 |
| dried_fish | 1 |
| egg | 5 |
| rice_white | 3 |
| sweet_potato | 3 |
| corn | 3 |
| potato | 3 |
| new_egg_noodle | 3 |
| olive_oil | 3 |
| sugary_drink | 3 |
| new_salt | 2 |
| new_soy_sauce | 2 |
| cherry | 2 |
| apple | 2 |
| blueberry | 2 |
| pear | 2 |
| orange | 2 |
| banana | 2 |
| watermelon | 2 |
| grape | 2 |
| lychee | 2 |
| juice | 1 |
| principles | 2 |
| goal_summaries | 5 |
| sources | 41 |
| gaps | 4 |

主要动作：撤下备注旧值及未经补证的份量换算；恢复8个USDA能量条目的准确文字与引用；鸡蛋面按主食管理；移除普通成人定量迁移；修正根层旧统计、摘要访问状态及版本日期含义。来源版本更新状态改为unclear，避免把读取了旧文献等同于已核验其截至研究日仍为最新版本。

自动检查结果另存`acceptance-r5/`；研究参考与未临床审核状态保留。详细计量和证据基准见`食材数据基准说明.md`。
