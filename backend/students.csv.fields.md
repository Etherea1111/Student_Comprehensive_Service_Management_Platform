# students.csv 字段说明

`backend/students.csv` 用于学生信息批量导入。字段说明以当前 CSV 表头和后端学生导入接口为准。

当前 CSV 表头：

```csv
student_no,name,college,major,class_name,grade,education_level,political_status,party_stage,league_stage,phone,id_card,birthplace,household_register,ethnicity,advisor,student_status,is_alumni,awards,remark
```

## 字段明细

| 序号 | 字段名 | 含义 | 是否必填 | 导入处理规则 |
| --- | --- | --- | --- | --- |
| 1 | `student_no` | 学号 | 是 | 必须为 10 位数字；用于学生唯一匹配和学号账号生成。 |
| 2 | `name` | 姓名 | 是 | 与学号共同用于身份核验和导入匹配。 |
| 3 | `college` | 学院 | 否 | 为空时后端默认写入“信息学院”。 |
| 4 | `major` | 专业 | 是 | 不能为空；例如“计算机科学与技术”。 |
| 5 | `class_name` | 班级 | 是 | 不能为空；例如“计科2401”。 |
| 6 | `grade` | 年级 | 是 | 不能为空；例如“2024级”。 |
| 7 | `education_level` | 培养层次 | 否 | 例如“本科”“硕士”“博士”。 |
| 8 | `political_status` | 政治面貌 | 否 | 例如“共青团员”“群众”“中共党员”。 |
| 9 | `party_stage` | 入党流程阶段编码 | 否 | 为空时后端默认 `none`；常用值包括 `applicant`、`activist`、`development`、`probationary`、`full`。 |
| 10 | `league_stage` | 入团流程阶段编码 | 否 | 为空时后端默认 `none`；常用值包括 `applicant`、`candidate`、`member`。 |
| 11 | `phone` | 手机号 | 否 | 敏感字段；导入后由后端加密保存，展示时按权限脱敏。 |
| 12 | `id_card` | 身份证号 | 否 | 敏感字段；导入后由后端加密保存，展示时按权限脱敏。 |
| 13 | `birthplace` | 生源地 | 否 | 敏感字段；导入后由后端加密保存。 |
| 14 | `household_register` | 户籍 | 否 | 敏感字段；导入后由后端加密保存。 |
| 15 | `ethnicity` | 民族 | 否 | 基础信息字段，可按需求公开展示。 |
| 16 | `advisor` | 导师/负责人 | 否 | 受限信息；展示时按角色权限控制。 |
| 17 | `student_status` | 学籍状态 | 是 | 不能为空；例如“在读”“休学”“毕业”“转学”“退学”。特殊状态展示时按权限控制。 |
| 18 | `is_alumni` | 是否校友/离校 | 否 | 填写“是”“true”“TRUE”“1”会按是处理；其他值按否处理。 |
| 19 | `awards` | 获奖情况 | 否 | 学生扩展信息，可为空。 |
| 20 | `remark` | 备注 | 否 | 可能包含敏感说明；展示时需要按权限控制。 |

## 填写注意

1. 当前 CSV 不包含 `gender`、`birth_date`、`hometown` 字段，后端学生导入接口也不会读取这些字段。
2. 生源地请使用 `birthplace` 字段，不使用 `hometown`。
3. 若后续需要新增字段，应先扩展数据库表结构、导入服务和权限展示逻辑，再修改 CSV 表头。
4. 建议保持字段顺序不变，便于人工核对和后续批量导入排查。
