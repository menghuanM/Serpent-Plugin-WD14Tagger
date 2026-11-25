# 中文标签翻译核对记录

核对日期：2026-11-26。

本记录描述补充前的 85,810 项词库及原有 139 项译文修正。
0.1.7 新增的模型词表补充、覆盖统计及保留原文的边界另见
[模型词表补充核对记录](MODEL_TRANSLATION_REVIEW.md)。

## 范围与方法

- 词库总计 **85,810** 个键：30,693 个通用标签、35,384 个角色标签，以及 19,733 个英文别名。
- 下载项目锁定版本的两份源 CSV，验证 SHA-256 与原有来源记录相同，再结合英文标签、别名和注释核对译文。
- 全量检查 JSON 结构、重复键、键名规范、空白译文、控制字符、长度限制及译文括号；额外筛查颜色信息缺失、疑似占位文本和未含汉字的条目。
- 快速逐项审阅按源使用频率排序的前 5,000 个通用标签，并对服装、人体、动作及易混词作专项核查；审查 138 组通用规范标签共用中文译名的情况。
- 人工通读角色频率前 1,000 项，并全量筛查 35,384 个角色中的 170 组同译名碰撞；另逐项核查 34 个纯符号规范标签、32 个《世界树》编号肖像标签及 11 个 hololive 2019 夏日标签。
- 只修改有足够依据的译名。未将原样保留的型号、品牌、颜文字或无通行译名的专名一律视为漏译。
- 前 5,000 个通用标签的使用次数之和占源通用词表计数总和约 95.95%。这是标签使用次数的占比，不代表图片覆盖率、模型覆盖率或翻译准确率。
- 本次包含全量机器检查和上述人工语义审阅，**不代表 85,810 个译文均已逐条人工确认**。

固定上游版本：[8e73f3b1c15b30f873c11a8c65d2d8264cdf0224](https://github.com/amenorira/danbooru-tags-data-zh/tree/8e73f3b1c15b30f873c11a8c65d2d8264cdf0224)。输入哈希见[来源记录](source.json)。

外部交叉依据：

- [百鸽卡片数据库：Lady Labrynth of the Silver Castle](https://ygocdb.com/?search=Lady%20Labrynth%20of%20the%20Silver%20Castle)列出中文卡名“迷宫城的白银姬”，与 Lovely Labrynth 为不同卡名。
- [Arcaea 中文维基：红](https://wiki.arcaea.cn/index.php/%E7%BA%A2)的[页面源码](https://wiki.arcaea.cn/index.php?title=%E7%BA%A2&action=raw)使用搭档 ID 2；[搭档名称数据](https://wiki.arcaea.cn/index.php?title=Template:PartnerSummary.json&action=raw)的同一 ID 明确为 Kou，故将该项从存疑候选转为已确认修正。

## 已应用的修正

修正 **98 个规范标签**，同步修正 **41 个英文别名**，共 **139 个运行时词条**。键名、总条目数和原有排序保持不变。

| 英文规范标签 | 原译文 | 修正译文 | 依据或原因 | 同步别名 |
| --- | --- | --- | --- | --- |
| `!!` | 双感叹号 | 多个感叹号 | 此规范标签表示两个或更多感叹号，!!! 和 !!!! 是它的上游别名；双感叹号过窄。 | `!!!`、`!!!!` |
| `akai_haato_(hololive_summer_2019)` | 赤井心（hololive） | 赤井心（hololive 2019夏日泳装） | 固定源频率171；tag及源notes均明确hololive Summer 2019泳装；现译仅保留hololive所属，丢失年份和泳装限定。 | `akai_haato_(3rd_costume)` |
| `aqua_theme` | 水蓝色 | 水色主题 | 此类标签指整体配色主题，遗漏主题后会与泛指颜色的标签混淆。 | — |
| `arm_rest` | 手臂休息 | 手臂搭靠 | 此姿势标签指把手臂搭在物体、他人或自己身上支撑/歇力；现译像是手臂在休息，未表达搭靠这一动作关系。 | — |
| `bad_anatomy` | 错误解剖（肢体错位） | 人体结构错误 | 标签表示绘画中的人体结构错误，不限于肢体错位；错误解剖易被理解为解剖行为。 | — |
| `badminton` | 羽毛球 | 羽毛球运动 | 指运动项目，应区别shuttlecock实体羽毛球。 | — |
| `barbed_wire` | 铁丝网 | 带刺铁丝 | barbed指带刺，不等于一般的wire_fence铁丝网。 | `razor_wire` |
| `barnaby_brooks_jr.` | 巴纳比·布鲁克斯 | 巴纳比·布鲁克斯Jr. | 固定源频率3424；tag与源aliases均包含Jr.，现译删除了姓名中的小辈标识；沿用源aliases中的现成汉译恢复Jr.。 | `barnaby_brooks_jr` |
| `bokken` | 木剑 | 木刀（剑道） | 日式剑道用木刀，应区别泛指木剑的wooden_sword。 | `wooden_katana` |
| `brother_and_sister` | 兄妹 | 兄妹／姐弟 | 标签同时适用于哥哥与妹妹、姐姐与弟弟，原译未覆盖姐弟。 | — |
| `business_suit` | 西装 | 商务西装 | 特指商务西服套装，应区别泛指西装的suit。 | — |
| `carrot_print` | 胡萝卜印刷 | 胡萝卜印花 | print在衣物或物品上的图案标签中表示印花，不是印刷行为。 | — |
| `censored_by_text` | 文字打码 | 用文字遮挡打码 | 用文字遮挡其他画面，应区别文字本身被打码。 | — |
| `censored_text` | 文字打码 | 被打码的文字 | 文字本身被遮蔽，应区别用文字遮挡其他画面。 | — |
| `chandelier` | 吊灯 | 枝形吊灯 | 特指带多个灯臂的枝形吊灯，应区别hanging_light泛指吊灯。 | — |
| `chess_piece` | 棋子 | 国际象棋棋子 | chess限定国际象棋，原译遗漏棋类。 | — |
| `chloe_(pokemon)` | 小春（宝可梦） | 小春（宝可梦 旅途） | 固定源频率519；源notes明确旅途动画中的少女；当前与朱／紫男主角florian_(pokemon)同为小春（宝可梦），增加具体作品消歧。 | `sakuragi_koharu` |
| `cleft_of_venus` | 耻丘缝 | 阴裂 | 该解剖标签指大阴唇之间的细缝；耻丘是 mons pubis（阴阜），不是阴唇间隙，现译把部位指错。 | — |
| `clock_tower` | 钟楼 | 时钟塔 | 指装有钟面的塔，应区别悬挂敲击钟的bell_tower。 | — |
| `clover_hair_ornament` | 苜蓿形发饰 | 三叶草形发饰 | clover指三叶草（车轴草），不等于苜蓿；与clover标签统一。 | — |
| `cousins` | 表亲 | 堂表亲 | 英语cousins涵盖堂亲与表亲，原译仅覆盖表亲。 | — |
| `covered_navel` | 遮挡肚脐 | 衣下肚脐轮廓 | 标签注释描述紧身衣物下透出的肚脐形状，现译仅表示肚脐被遮住，没有表达透过衣物可见的轮廓。 | `clothed_navel` |
| `covered_nipples` | 遮挡乳头 | 衣下乳头凸起 | 标签及别名 erect_nipples_under_clothes 指乳头在衣物下顶出的凸起；现译只表达乳头被遮住，遗漏了可见凸起这一核心特征。 | `erect_nipples_under_clothes`、`perky_nipples` |
| `cropped_torso` | 裁剪掉躯干 | 腰部以下出框 | 该构图标签描述画面只到腰部以上、下身被画框截去；现译误指躯干本身被裁掉，裁切部位错了。 | — |
| `dante_(dmc:_devil_may_cry)` | 但丁（鬼泣） | 但丁（DmC：鬼泣） | 固定源频率63；源notes明确重启版主角；现译与dante_(devil_may_cry)完全相同，丢失DmC重启版的作品限定。 | — |
| `dolphin_print` | 海豚印刷 | 海豚印花 | print在此指物品上的海豚图案。 | — |
| `dragonfly_print` | 蜻蜓印刷 | 蜻蜓印花 | print在此指物品上的蜻蜓图案。 | — |
| `drinking_glass` | 水杯 | 玻璃杯 | 特指玻璃饮用杯，应保留材质以区别泛指杯子的cup。 | — |
| `dropkick` | 飞踢 | 双脚飞踢 | 特征为跃起后双脚同时蹬出，应区别泛指飞踢的flying_kick。 | `drop_kick` |
| `e.g.o_(project_moon)` | E.G.O（月亮计划） | E.G.O（Project Moon） | 固定源频率9368；Project Moon是开发商专名；同库诸多对应标签保留Project Moon。月亮计划误作普通词直译，恢复原品牌名。 | `e.g.o` |
| `earpiece` | 听筒 | 单耳耳机 | 标签指只戴在一只耳朵上的耳机，听筒容易被理解为电话听筒。 | — |
| `emblem` | 徽章 | 徽记 | 指组织、家族等的标识性图案，应区别badge实体徽章。 | — |
| `energon` | 能量 | 能量体（变形金刚） | 变形金刚的专有能源名称，不是泛指energy能量；采用不限定固液形态的译法。 | — |
| `fencer_1_(sekaiju)` | 剑士（世界树的迷宫） | 剑士（立绘1）（世界树的迷宫） | 固定源频率58；tag明确保留立绘编号1，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `florian_(pokemon)` | 小春（宝可梦） | 小春（宝可梦 朱／紫） | 固定源频率3032；源notes明确朱／紫男主角；当前与动画旅途少女chloe_(pokemon)同为小春（宝可梦），增加源注释已确认的具体作品消歧。 | `florian`、`male_protagonist_(pokemon_sv)` |
| `fortress_2_(sekaiju)` | 要塞（世界树的迷宫） | 要塞（立绘2）（世界树的迷宫） | 固定源频率86；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `goldfish_print` | 金鱼印刷 | 金鱼印花 | print在此指物品上的金鱼图案。 | — |
| `green_border` | 绿色边界 | 绿色边框 | 此处border指图像四周的边框，与其他颜色边框术语保持一致。 | — |
| `grey_border` | 灰色边界 | 灰色边框 | 此处border指图像四周的边框，与其他颜色边框术语保持一致。 | `gray_border` |
| `grey_theme` | 灰色 | 灰色主题 | 此类标签指整体配色主题，遗漏主题。 | `gray_theme` |
| `hair_intakes` | 发须 | 进气口发型 | 此处intakes比喻头顶两侧如进气口般拱起的发流，不是胡须或长发须。 | `hair_vents` |
| `hand_rest` | 手部休息 | 手部搭靠 | 与arm_rest同属姿势标签，指将手搭在物体或他人身上，不是单指休息。 | — |
| `highleg_dress` | Highleg连衣裙 | 高开叉连衣裙 | 原译Highleg连衣裙遗漏关键修饰词的中文含义；源注释明确为高开衩至胯部，与highleg系列统一。 | — |
| `honeycomb_print` | 蜂窝印刷 | 蜂窝纹印花 | print在此指物品上的蜂窝纹样。 | — |
| `infection_monitor_(arknights)` | 感染监控（明日方舟） | 感染监测装置（明日方舟） | monitor指用于监测矿石病感染程度的医疗装置，不是监控行为。 | — |
| `kou_(arcaea)` | 光（韵律源点） | 红（韵律源点） | 原译误混为光（Hikari）。Arcaea中文维基红页面立绘ID为2，其PartnerSummary同ID名称为Kou，已交叉核实。 | — |
| `lace_border` | 花边边界 | 蕾丝边框 | 此处指图像四周的蕾丝或花边装饰，不是边界。 | — |
| `lady_labrynth_of_the_silver_castle` | 白银城的迷宫主·拉比丽斯 | 迷宫城的白银姬（游戏王） | 固定源频率156；Lady Labrynth对应迷宫城的白银姬，与Lovely Labrynth是不同卡名；现译完全复制lovely_labrynth_of_the_silver_castle的白银城的迷宫主·拉比丽斯，丢失战斗形态卡名区分。 | — |
| `lady_labrynth_of_the_silver_castle_(alternate_art)` | 白银城的迷宫主·拉比丽斯（异画） | 迷宫城的白银姬（异画）（游戏王） | 固定源频率57；与Lady Labrynth主标签联动恢复正确卡名，保留原有异画限定；目前连同基础卡名误混为Lovely Labrynth。 | — |
| `letterboxed` | 信箱格式 | 画面上下有横向遮幅 | 图像标签指上下加横条的画幅处理，信箱格式不能清楚表达该视觉含义。 | `letter_boxed`、`letterbox` |
| `lowleg_panties` | 低腿口内裤 | 低腰内裤 | 源英文别名low-rise_panties明确指低腰，与同库lowleg及low-rise系列一致；原译把腰线误作腿口。源注释与英文别名矛盾时，优先采用可明确判断的英文含义。 | `low-rise_panties` |
| `marine_angelfish` | 神仙鱼 | 海水神仙鱼 | marine限定海水，应区别一般angelfish。 | — |
| `max_(pokemon)` | 小胜（宝可梦） | 小胜（宝可梦动画） | 固定源频率208；源notes明确动画中小遥的弟弟；当前与剑／盾男主角victor_(pokemon)同为小胜（宝可梦），增加动画限定消歧。 | — |
| `medic_2_(sekaiju)` | 医疗士（世界树的迷宫） | 医疗士（立绘2）（世界树的迷宫） | 固定源频率175；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `medic_4_(sekaiju_4)` | 医疗士（世界树迷宫4） | 医疗士（立绘4）（世界树迷宫4） | 固定源频率60；tag明确保留立绘编号4，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `microphone_stand` | 麦克风杆 | 麦克风支架 | 用于支撑麦克风的支架，不是单指杆件。 | — |
| `mogador_kai_(kancolle)` | 莫加多尔（舰队Collection） | 莫加多尔改（舰队Collection） | 固定源频率89；tag含kai且notes明确改形态；现译与mogador_(kancolle)完全相同，漏译改。 | — |
| `monk_2_(sekaiju)` | 武僧（世界树的迷宫） | 武僧（立绘2）（世界树的迷宫） | 固定源频率143；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `monk_4_(sekaiju)` | 武僧（世界树的迷宫） | 武僧（立绘4）（世界树的迷宫） | 固定源频率90；tag明确保留立绘编号4，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `murasaki_shion_(hololive_summer_2019)` | 紫咲诗音（hololive） | 紫咲诗音（hololive 2019夏日泳装） | 固定源频率242；tag及源notes均明确hololive Summer 2019泳装；现译仅保留hololive所属，丢失年份和泳装限定。 | `murasaki_shion_(3rd_costume)` |
| `nakiri_ayame_(hololive_summer_2019)` | 百鬼绫目（hololive） | 百鬼绫目（hololive 2019夏日泳装） | 固定源频率188；tag及源notes均明确hololive Summer 2019泳装；现译仅保留hololive所属，丢失年份和泳装限定。 | `nakiri_ayame_(2nd_costume)`、`nakiri_ayame_(summertime_nakiri)` |
| `natsuiro_matsuri_(hololive_summer_2019)` | 夏色祭（hololive） | 夏色祭（hololive 2019夏日泳装） | 固定源频率188；tag及源notes均明确hololive Summer 2019泳装；现译仅保留hololive所属，丢失年份和泳装限定。 | `natsuiro_matsuri_(3rd_costume)` |
| `necromancer_2_(sekaiju)` | 死灵术士（世界树的迷宫） | 死灵术士（立绘2）（世界树的迷宫） | 固定源频率55；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `night_seeker_2_(sekaiju)` | 夜行者（世界树的迷宫） | 夜行者（立绘2）（世界树的迷宫） | 固定源频率85；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `no_pants` | 不穿裤子 | 未穿外层下装 | 原始别名还包括no_shorts、no_skirt、skirtless，标签实际涵盖未穿裤子或裙子但可以穿内裤；用概括性译法避免把no_skirt译成不穿裤子。 | `no_shorts`、`no_skirt`、`pantless`、`pantsless`、`skirtless` |
| `okamisty` | 米斯蒂娅·萝蕾拉 | 米斯蒂娅·萝蕾拉（老板娘装扮） | 固定源频率1846；源notes明确指米斯蒂娅的老板娘装扮；现译与mystia_lorelei（频率16209）完全相同，丢失此独立标签的装扮区分。 | — |
| `orange_theme` | 橙色 | 橙色主题 | 此类标签指整体配色主题，遗漏主题。 | — |
| `painting_(object)` | 绘画 | 画作（物品） | 此处是画面内出现的实体画作，不是绘画行为或媒介。 | — |
| `phalanx_2_(sekaiju)` | 方阵兵（世界树的迷宫） | 方阵兵（立绘2）（世界树的迷宫） | 固定源频率101；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `polka_dot_border` | 圆点边界 | 圆点边框 | 此处border指带圆点图案的图像边框。 | — |
| `porridge` | 稀饭 | 粥 | 包括各种谷物熬成的粥，不限于通常以米熬成的稀饭。 | — |
| `producer_(idolmaster_anime)` | 制作人（偶像大师） | 制作人（偶像大师动画版） | 固定源频率388；源notes明确为动画中戴眼镜的高个青年；现译与系列通用玩家角色producer_(idolmaster)完全相同，丢失anime区分。 | — |
| `rainbow_print` | 彩虹印刷 | 彩虹印花 | print在此指物品上的彩虹或彩虹色图案。 | — |
| `ranger_1_(sekaiju)` | 突击者（世界树的迷宫） | 突击者（立绘1）（世界树的迷宫） | 固定源频率78；tag明确保留立绘编号1，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `ranger_2_(sekaiju)` | 突击者（世界树的迷宫） | 突击者（立绘2）（世界树的迷宫） | 固定源频率57；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `reaper_1_(sekaiju)` | 死神（世界树的迷宫） | 死神（立绘1）（世界树的迷宫） | 固定源频率64；tag明确保留立绘编号1，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `rice` | 大米 | 大米／米饭 | 原标签既包括生米也包括熟米饭，只译大米遗漏熟食含义。 | — |
| `rice_porridge` | 稀饭 | 米粥 | rice限定米，应区别泛指谷物粥的porridge。 | — |
| `rosary` | 念珠 | 玫瑰经念珠 | 特指天主教玫瑰经念珠，应区别泛指祈祷串珠的prayer_beads。 | — |
| `rune_master_2_(sekaiju)` | 符文大师（世界树的迷宫） | 符文大师（立绘2）（世界树的迷宫） | 固定源频率66；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `sakura_miko_(hololive_summer_2019)` | 樱巫女（hololive） | 樱巫女（hololive 2019夏日泳装） | 固定源频率116；tag及源notes均明确hololive Summer 2019泳装；现译仅保留hololive所属，丢失年份和泳装限定。 | `sakura_miko_(2nd_costume)` |
| `sculpting` | 雕塑 | 制作雕塑 | sculpting表示制作雕塑的行为，sculpture才是雕塑作品。 | — |
| `shinobi_4_(sekaiju)` | 忍者（世界树的迷宫） | 忍者（立绘4）（世界树的迷宫） | 固定源频率120；tag明确保留立绘编号4，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `single_hair_intake` | 单束发须 | 单侧进气口发型 | 与hair_intakes联动，此处指只有一侧的进气口状发型，不是单束毛须。 | `single_hair_vent` |
| `sitting_on_hand` | 坐在手边 | 坐在手上 | on hand在该姿势标签中指坐在他人手掌上，不是在手边或旁边。 | — |
| `sovereign_2_(sekaiju)` | 君主（世界树的迷宫） | 君主（立绘2）（世界树的迷宫） | 固定源频率167；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | `princess_2_(sekaiju)` |
| `spoken_musical_note` | 表达声音的音符 | 音符气泡 | spoken系列指对话特效中的符号，不是泛指可表达声音的任何音符。 | `spoken_note` |
| `star_of_david` | 六芒星 | 大卫之星 | 指犹太教象征大卫之星，应区别泛指六芒星的hexagram。 | — |
| `unmoving_pattern` | 连续重复的花纹 | 不随衣褶变化的花纹 | 特征是花纹不随衣物褶皱产生变形，连续重复不能表达此特征。 | `unmoving_plaid` |
| `vega_(street_fighter)` | 维加（街头霸王） | 巴洛克（街头霸王） | 固定源频率290；源alias=claw_(street_fighter)，notes明确利爪角色；当前与m._bison的维加完全相同，混淆国际版Vega/日版Balrog与国际版M.Bison/日版Vega。按本库m._bison=维加的日版命名口径，利爪角色应为巴洛克。 | `claw_(street_fighter)` |
| `victor_(pokemon)` | 小胜（宝可梦） | 小胜（宝可梦 剑／盾） | 固定源频率1590；源notes明确剑／盾男性主角；当前与动画角色max_(pokemon)同为小胜（宝可梦），增加具体作品消歧。 | `henry_sword`、`male_protagonist_(pokemon_swsh)`、`masaru_(pokemon)`、`victor` |
| `vivlos_(umamusume)` | 微光飞驹（赛马娘） | 强击（赛马娘） | 固定源频率2504；源aliases明确为强击\|比布鲁斯；微光飞驹属于另一个canonical biko_pegasus_(umamusume)（频率310），现译把不同角色合并。 | — |
| `warlock_2_(sekaiju)` | 术士（世界树的迷宫） | 术士（立绘2）（世界树的迷宫） | 固定源频率63；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `wing_collar` | 翅膀衣领 | 翼领 | 服装术语wing collar指领角翻折呈翼状的衣领，不是以翅膀制成或装饰的衣领；采用通行衣领名称。 | — |
| `yuzuki_choco_(hololive_summer_2019)` | 愈月巧可（hololive） | 愈月巧可（hololive 2019夏日泳装） | 固定源频率103；tag及源notes均明确hololive Summer 2019泳装；现译仅保留hololive所属，丢失年份和泳装限定。 | `yuzuki_choco_(3rd_costume)` |
| `zero(z)_(mega_man)` | 零（洛克人） | 零（洛克人ZERO） | 固定源频率1591；源aliases含Zero (Mega Man Zero)，notes明确洛克人ZERO系列；现译与zero_(mega_man)完全相同，恢复该标签所指子系列。 | `zero_(mega_man_zero)` |
| `zodiac_2_(sekaiju)` | 占星师（世界树的迷宫） | 占星师（立绘2）（世界树的迷宫） | 固定源频率98；tag明确保留立绘编号2，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |
| `zodiac_4_(sekaiju)` | 占星师（世界树的迷宫） | 占星师（立绘4）（世界树的迷宫） | 固定源频率103；tag明确保留立绘编号4，源notes为角色肖像/立绘；现译丢失编号，与同职业总标签或其他编号立绘混成同一译名。仅恢复数字标识，不改职业译法。 | — |

## 保留的疑点与审阅边界

- `cartridge`：源词表将其标为歧义标签，可能指弹药、胶卷盒或游戏卡带。现有“弹药”含义偏窄，但缺少上下文，无法安全改为某个单一译名，本次暂留。
- `chikafuji_lisa`：当前“千坂爱理”与 `chisaka_airi` 同名，源注释不能排除别名或角色关系，缺少可靠汉名，暂留。
- `mori_(nikke)`：当前“森（胜利女神：妮姬）”与 `sin_(nikke)` 同译名，缺少能确认 Mori 官方汉名的资料，暂留。
- `mortenax_blade_(honkai:_star_rail)`：当前与普通刃同译名，标签和别名提示另一形态，但尚未核实正式中文名，暂留。
- `interface_headset_(evangelion)`：当前“接口式耳机”可疑，未取得足够的原作术语依据，不凭印象改为其他名称。
- `lowleg` 系列的源英文别名明确为 low-rise（低腰），部分中文 notes 却写成低腿口。本次按可确认的英文别名统一 `lowleg_panties` 为“低腰内裤”，保留 `lowleg_bikini` 的“低腰比基尼”。
- `standing_up`、`fighting`、`vomit`：初筛存在区分建议，但源注释仍支持现有译法，或不足以确认其独立标签语义；本轮未改。
- 角色专名优先使用源别名中明确的名称或系列中的通行译名。没有可靠对应关系的罗马字专名、玩家自创角色及地区译名差异继续保留，未凭拼写猜译。
- 同译名不一定是错误，例如不同英文同义词或合理的中文多义词。仅在遗漏关键语义、实体身份混淆或具有明确区分依据时修改。

## 维护与验证

- [运行时词典](tags-zh-CN.json)包含已应用的修正；[本地修正表](tags-zh-CN.overrides.json)逐键保存修正值，包含相应英文别名。
- [导入脚本](../scripts/update-translations.cjs)在上游别名展开完成后应用本地修正，保持上游键集合，并拒绝不存在的键、未规范化的键或无效译文。后续改换上游版本时需一起复核这张表。
- [来源记录](source.json)保留原始 CSV 哈希，额外记录修正表的 SHA-256 和条目数，以区分上游快照与本地修正。
- 全量校验通过：85,810 个键，新增 0、删除 0、重复 0；全部译文符合非空、去除首尾空白、无控制字符及 255 字符限制。实际差异为 139 项，均与本地修正表逐键一致。
- 固定源 CSV 和本地修正表的 SHA-256 校验通过；包含汉字的值为 84,390 项，来源记录与实际词库一致。
- 使用已验证的固定源文件离线运行导入脚本，生成的词典与现有词典逐字节一致，来源元数据和许可证也一致。
- `node --check scripts/update-translations.cjs` 通过；项目现有打标及离线翻译回归套件 `node scripts/test-tagging.cjs`：39 项全部通过，失败 0。
