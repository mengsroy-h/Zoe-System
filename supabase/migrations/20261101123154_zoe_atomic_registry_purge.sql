create function private.zoe_purge_registry_key_v1(p_code text) returns text
language plpgsql immutable set search_path = ''
as $$
declare
    mappings jsonb := $zoe_upper_17${"97":"A","98":"B","99":"C","100":"D","101":"E","102":"F","103":"G","104":"H","105":"I","106":"J","107":"K","108":"L","109":"M","110":"N","111":"O","112":"P","113":"Q","114":"R","115":"S","116":"T","117":"U","118":"V","119":"W","120":"X","121":"Y","122":"Z","181":"Μ","223":"SS","224":"À","225":"Á","226":"Â","227":"Ã","228":"Ä","229":"Å","230":"Æ","231":"Ç","232":"È","233":"É","234":"Ê","235":"Ë","236":"Ì","237":"Í","238":"Î","239":"Ï","240":"Ð","241":"Ñ","242":"Ò","243":"Ó","244":"Ô","245":"Õ","246":"Ö","248":"Ø","249":"Ù","250":"Ú","251":"Û","252":"Ü","253":"Ý","254":"Þ","255":"Ÿ","257":"Ā","259":"Ă","261":"Ą","263":"Ć","265":"Ĉ","267":"Ċ","269":"Č","271":"Ď","273":"Đ","275":"Ē","277":"Ĕ","279":"Ė","281":"Ę","283":"Ě","285":"Ĝ","287":"Ğ","289":"Ġ","291":"Ģ","293":"Ĥ","295":"Ħ","297":"Ĩ","299":"Ī","301":"Ĭ","303":"Į","305":"I","307":"Ĳ","309":"Ĵ","311":"Ķ","314":"Ĺ","316":"Ļ","318":"Ľ","320":"Ŀ","322":"Ł","324":"Ń","326":"Ņ","328":"Ň","329":"ʼN","331":"Ŋ","333":"Ō","335":"Ŏ","337":"Ő","339":"Œ","341":"Ŕ","343":"Ŗ","345":"Ř","347":"Ś","349":"Ŝ","351":"Ş","353":"Š","355":"Ţ","357":"Ť","359":"Ŧ","361":"Ũ","363":"Ū","365":"Ŭ","367":"Ů","369":"Ű","371":"Ų","373":"Ŵ","375":"Ŷ","378":"Ź","380":"Ż","382":"Ž","383":"S","384":"Ƀ","387":"Ƃ","389":"Ƅ","392":"Ƈ","396":"Ƌ","402":"Ƒ","405":"Ƕ","409":"Ƙ","410":"Ƚ","411":"Ƛ","414":"Ƞ","417":"Ơ","419":"Ƣ","421":"Ƥ","424":"Ƨ","429":"Ƭ","432":"Ư","436":"Ƴ","438":"Ƶ","441":"Ƹ","445":"Ƽ","447":"Ƿ","453":"Ǆ","454":"Ǆ","456":"Ǉ","457":"Ǉ","459":"Ǌ","460":"Ǌ","462":"Ǎ","464":"Ǐ","466":"Ǒ","468":"Ǔ","470":"Ǖ","472":"Ǘ","474":"Ǚ","476":"Ǜ","477":"Ǝ","479":"Ǟ","481":"Ǡ","483":"Ǣ","485":"Ǥ","487":"Ǧ","489":"Ǩ","491":"Ǫ","493":"Ǭ","495":"Ǯ","496":"J̌","498":"Ǳ","499":"Ǳ","501":"Ǵ","505":"Ǹ","507":"Ǻ","509":"Ǽ","511":"Ǿ","513":"Ȁ","515":"Ȃ","517":"Ȅ","519":"Ȇ","521":"Ȉ","523":"Ȋ","525":"Ȍ","527":"Ȏ","529":"Ȑ","531":"Ȓ","533":"Ȕ","535":"Ȗ","537":"Ș","539":"Ț","541":"Ȝ","543":"Ȟ","547":"Ȣ","549":"Ȥ","551":"Ȧ","553":"Ȩ","555":"Ȫ","557":"Ȭ","559":"Ȯ","561":"Ȱ","563":"Ȳ","572":"Ȼ","575":"Ȿ","576":"Ɀ","578":"Ɂ","583":"Ɇ","585":"Ɉ","587":"Ɋ","589":"Ɍ","591":"Ɏ","592":"Ɐ","593":"Ɑ","594":"Ɒ","595":"Ɓ","596":"Ɔ","598":"Ɖ","599":"Ɗ","601":"Ə","603":"Ɛ","604":"Ɜ","608":"Ɠ","609":"Ɡ","611":"Ɣ","612":"Ɤ","613":"Ɥ","614":"Ɦ","616":"Ɨ","617":"Ɩ","618":"Ɪ","619":"Ɫ","620":"Ɬ","623":"Ɯ","625":"Ɱ","626":"Ɲ","629":"Ɵ","637":"Ɽ","640":"Ʀ","642":"Ʂ","643":"Ʃ","647":"Ʇ","648":"Ʈ","649":"Ʉ","650":"Ʊ","651":"Ʋ","652":"Ʌ","658":"Ʒ","669":"Ʝ","670":"Ʞ","837":"Ι","881":"Ͱ","883":"Ͳ","887":"Ͷ","891":"Ͻ","892":"Ͼ","893":"Ͽ","912":"Ϊ́","940":"Ά","941":"Έ","942":"Ή","943":"Ί","944":"Ϋ́","945":"Α","946":"Β","947":"Γ","948":"Δ","949":"Ε","950":"Ζ","951":"Η","952":"Θ","953":"Ι","954":"Κ","955":"Λ","956":"Μ","957":"Ν","958":"Ξ","959":"Ο","960":"Π","961":"Ρ","962":"Σ","963":"Σ","964":"Τ","965":"Υ","966":"Φ","967":"Χ","968":"Ψ","969":"Ω","970":"Ϊ","971":"Ϋ","972":"Ό","973":"Ύ","974":"Ώ","976":"Β","977":"Θ","981":"Φ","982":"Π","983":"Ϗ","985":"Ϙ","987":"Ϛ","989":"Ϝ","991":"Ϟ","993":"Ϡ","995":"Ϣ","997":"Ϥ","999":"Ϧ","1001":"Ϩ","1003":"Ϫ","1005":"Ϭ","1007":"Ϯ","1008":"Κ","1009":"Ρ","1010":"Ϲ","1011":"Ϳ","1013":"Ε","1016":"Ϸ","1019":"Ϻ","1072":"А","1073":"Б","1074":"В","1075":"Г","1076":"Д","1077":"Е","1078":"Ж","1079":"З","1080":"И","1081":"Й","1082":"К","1083":"Л","1084":"М","1085":"Н","1086":"О","1087":"П","1088":"Р","1089":"С","1090":"Т","1091":"У","1092":"Ф","1093":"Х","1094":"Ц","1095":"Ч","1096":"Ш","1097":"Щ","1098":"Ъ","1099":"Ы","1100":"Ь","1101":"Э","1102":"Ю","1103":"Я","1104":"Ѐ","1105":"Ё","1106":"Ђ","1107":"Ѓ","1108":"Є","1109":"Ѕ","1110":"І","1111":"Ї","1112":"Ј","1113":"Љ","1114":"Њ","1115":"Ћ","1116":"Ќ","1117":"Ѝ","1118":"Ў","1119":"Џ","1121":"Ѡ","1123":"Ѣ","1125":"Ѥ","1127":"Ѧ","1129":"Ѩ","1131":"Ѫ","1133":"Ѭ","1135":"Ѯ","1137":"Ѱ","1139":"Ѳ","1141":"Ѵ","1143":"Ѷ","1145":"Ѹ","1147":"Ѻ","1149":"Ѽ","1151":"Ѿ","1153":"Ҁ","1163":"Ҋ","1165":"Ҍ","1167":"Ҏ","1169":"Ґ","1171":"Ғ","1173":"Ҕ","1175":"Җ","1177":"Ҙ","1179":"Қ","1181":"Ҝ","1183":"Ҟ","1185":"Ҡ","1187":"Ң","1189":"Ҥ","1191":"Ҧ","1193":"Ҩ","1195":"Ҫ","1197":"Ҭ","1199":"Ү","1201":"Ұ","1203":"Ҳ","1205":"Ҵ","1207":"Ҷ","1209":"Ҹ","1211":"Һ","1213":"Ҽ","1215":"Ҿ","1218":"Ӂ","1220":"Ӄ","1222":"Ӆ","1224":"Ӈ","1226":"Ӊ","1228":"Ӌ","1230":"Ӎ","1231":"Ӏ","1233":"Ӑ","1235":"Ӓ","1237":"Ӕ","1239":"Ӗ","1241":"Ә","1243":"Ӛ","1245":"Ӝ","1247":"Ӟ","1249":"Ӡ","1251":"Ӣ","1253":"Ӥ","1255":"Ӧ","1257":"Ө","1259":"Ӫ","1261":"Ӭ","1263":"Ӯ","1265":"Ӱ","1267":"Ӳ","1269":"Ӵ","1271":"Ӷ","1273":"Ӹ","1275":"Ӻ","1277":"Ӽ","1279":"Ӿ","1281":"Ԁ","1283":"Ԃ","1285":"Ԅ","1287":"Ԇ","1289":"Ԉ","1291":"Ԋ","1293":"Ԍ","1295":"Ԏ","1297":"Ԑ","1299":"Ԓ","1301":"Ԕ","1303":"Ԗ","1305":"Ԙ","1307":"Ԛ","1309":"Ԝ","1311":"Ԟ","1313":"Ԡ","1315":"Ԣ","1317":"Ԥ","1319":"Ԧ","1321":"Ԩ","1323":"Ԫ","1325":"Ԭ","1327":"Ԯ","1377":"Ա","1378":"Բ","1379":"Գ","1380":"Դ","1381":"Ե","1382":"Զ","1383":"Է","1384":"Ը","1385":"Թ","1386":"Ժ","1387":"Ի","1388":"Լ","1389":"Խ","1390":"Ծ","1391":"Կ","1392":"Հ","1393":"Ձ","1394":"Ղ","1395":"Ճ","1396":"Մ","1397":"Յ","1398":"Ն","1399":"Շ","1400":"Ո","1401":"Չ","1402":"Պ","1403":"Ջ","1404":"Ռ","1405":"Ս","1406":"Վ","1407":"Տ","1408":"Ր","1409":"Ց","1410":"Ւ","1411":"Փ","1412":"Ք","1413":"Օ","1414":"Ֆ","1415":"ԵՒ","4304":"Ა","4305":"Ბ","4306":"Გ","4307":"Დ","4308":"Ე","4309":"Ვ","4310":"Ზ","4311":"Თ","4312":"Ი","4313":"Კ","4314":"Ლ","4315":"Მ","4316":"Ნ","4317":"Ო","4318":"Პ","4319":"Ჟ","4320":"Რ","4321":"Ს","4322":"Ტ","4323":"Უ","4324":"Ფ","4325":"Ქ","4326":"Ღ","4327":"Ყ","4328":"Შ","4329":"Ჩ","4330":"Ც","4331":"Ძ","4332":"Წ","4333":"Ჭ","4334":"Ხ","4335":"Ჯ","4336":"Ჰ","4337":"Ჱ","4338":"Ჲ","4339":"Ჳ","4340":"Ჴ","4341":"Ჵ","4342":"Ჶ","4343":"Ჷ","4344":"Ჸ","4345":"Ჹ","4346":"Ჺ","4349":"Ჽ","4350":"Ჾ","4351":"Ჿ","5112":"Ᏸ","5113":"Ᏹ","5114":"Ᏺ","5115":"Ᏻ","5116":"Ᏼ","5117":"Ᏽ","7296":"В","7297":"Д","7298":"О","7299":"С","7300":"Т","7301":"Т","7302":"Ъ","7303":"Ѣ","7304":"Ꙋ","7306":"Ᲊ","7545":"Ᵹ","7549":"Ᵽ","7566":"Ᶎ","7681":"Ḁ","7683":"Ḃ","7685":"Ḅ","7687":"Ḇ","7689":"Ḉ","7691":"Ḋ","7693":"Ḍ","7695":"Ḏ","7697":"Ḑ","7699":"Ḓ","7701":"Ḕ","7703":"Ḗ","7705":"Ḙ","7707":"Ḛ","7709":"Ḝ","7711":"Ḟ","7713":"Ḡ","7715":"Ḣ","7717":"Ḥ","7719":"Ḧ","7721":"Ḩ","7723":"Ḫ","7725":"Ḭ","7727":"Ḯ","7729":"Ḱ","7731":"Ḳ","7733":"Ḵ","7735":"Ḷ","7737":"Ḹ","7739":"Ḻ","7741":"Ḽ","7743":"Ḿ","7745":"Ṁ","7747":"Ṃ","7749":"Ṅ","7751":"Ṇ","7753":"Ṉ","7755":"Ṋ","7757":"Ṍ","7759":"Ṏ","7761":"Ṑ","7763":"Ṓ","7765":"Ṕ","7767":"Ṗ","7769":"Ṙ","7771":"Ṛ","7773":"Ṝ","7775":"Ṟ","7777":"Ṡ","7779":"Ṣ","7781":"Ṥ","7783":"Ṧ","7785":"Ṩ","7787":"Ṫ","7789":"Ṭ","7791":"Ṯ","7793":"Ṱ","7795":"Ṳ","7797":"Ṵ","7799":"Ṷ","7801":"Ṹ","7803":"Ṻ","7805":"Ṽ","7807":"Ṿ","7809":"Ẁ","7811":"Ẃ","7813":"Ẅ","7815":"Ẇ","7817":"Ẉ","7819":"Ẋ","7821":"Ẍ","7823":"Ẏ","7825":"Ẑ","7827":"Ẓ","7829":"Ẕ","7830":"H̱","7831":"T̈","7832":"W̊","7833":"Y̊","7834":"Aʾ","7835":"Ṡ","7841":"Ạ","7843":"Ả","7845":"Ấ","7847":"Ầ","7849":"Ẩ","7851":"Ẫ","7853":"Ậ","7855":"Ắ","7857":"Ằ","7859":"Ẳ","7861":"Ẵ","7863":"Ặ","7865":"Ẹ","7867":"Ẻ","7869":"Ẽ","7871":"Ế","7873":"Ề","7875":"Ể","7877":"Ễ","7879":"Ệ","7881":"Ỉ","7883":"Ị","7885":"Ọ","7887":"Ỏ","7889":"Ố","7891":"Ồ","7893":"Ổ","7895":"Ỗ","7897":"Ộ","7899":"Ớ","7901":"Ờ","7903":"Ở","7905":"Ỡ","7907":"Ợ","7909":"Ụ","7911":"Ủ","7913":"Ứ","7915":"Ừ","7917":"Ử","7919":"Ữ","7921":"Ự","7923":"Ỳ","7925":"Ỵ","7927":"Ỷ","7929":"Ỹ","7931":"Ỻ","7933":"Ỽ","7935":"Ỿ","7936":"Ἀ","7937":"Ἁ","7938":"Ἂ","7939":"Ἃ","7940":"Ἄ","7941":"Ἅ","7942":"Ἆ","7943":"Ἇ","7952":"Ἐ","7953":"Ἑ","7954":"Ἒ","7955":"Ἓ","7956":"Ἔ","7957":"Ἕ","7968":"Ἠ","7969":"Ἡ","7970":"Ἢ","7971":"Ἣ","7972":"Ἤ","7973":"Ἥ","7974":"Ἦ","7975":"Ἧ","7984":"Ἰ","7985":"Ἱ","7986":"Ἲ","7987":"Ἳ","7988":"Ἴ","7989":"Ἵ","7990":"Ἶ","7991":"Ἷ","8000":"Ὀ","8001":"Ὁ","8002":"Ὂ","8003":"Ὃ","8004":"Ὄ","8005":"Ὅ","8016":"Υ̓","8017":"Ὑ","8018":"Υ̓̀","8019":"Ὓ","8020":"Υ̓́","8021":"Ὕ","8022":"Υ̓͂","8023":"Ὗ","8032":"Ὠ","8033":"Ὡ","8034":"Ὢ","8035":"Ὣ","8036":"Ὤ","8037":"Ὥ","8038":"Ὦ","8039":"Ὧ","8048":"Ὰ","8049":"Ά","8050":"Ὲ","8051":"Έ","8052":"Ὴ","8053":"Ή","8054":"Ὶ","8055":"Ί","8056":"Ὸ","8057":"Ό","8058":"Ὺ","8059":"Ύ","8060":"Ὼ","8061":"Ώ","8064":"ἈΙ","8065":"ἉΙ","8066":"ἊΙ","8067":"ἋΙ","8068":"ἌΙ","8069":"ἍΙ","8070":"ἎΙ","8071":"ἏΙ","8072":"ἈΙ","8073":"ἉΙ","8074":"ἊΙ","8075":"ἋΙ","8076":"ἌΙ","8077":"ἍΙ","8078":"ἎΙ","8079":"ἏΙ","8080":"ἨΙ","8081":"ἩΙ","8082":"ἪΙ","8083":"ἫΙ","8084":"ἬΙ","8085":"ἭΙ","8086":"ἮΙ","8087":"ἯΙ","8088":"ἨΙ","8089":"ἩΙ","8090":"ἪΙ","8091":"ἫΙ","8092":"ἬΙ","8093":"ἭΙ","8094":"ἮΙ","8095":"ἯΙ","8096":"ὨΙ","8097":"ὩΙ","8098":"ὪΙ","8099":"ὫΙ","8100":"ὬΙ","8101":"ὭΙ","8102":"ὮΙ","8103":"ὯΙ","8104":"ὨΙ","8105":"ὩΙ","8106":"ὪΙ","8107":"ὫΙ","8108":"ὬΙ","8109":"ὭΙ","8110":"ὮΙ","8111":"ὯΙ","8112":"Ᾰ","8113":"Ᾱ","8114":"ᾺΙ","8115":"ΑΙ","8116":"ΆΙ","8118":"Α͂","8119":"Α͂Ι","8124":"ΑΙ","8126":"Ι","8130":"ῊΙ","8131":"ΗΙ","8132":"ΉΙ","8134":"Η͂","8135":"Η͂Ι","8140":"ΗΙ","8144":"Ῐ","8145":"Ῑ","8146":"Ϊ̀","8147":"Ϊ́","8150":"Ι͂","8151":"Ϊ͂","8160":"Ῠ","8161":"Ῡ","8162":"Ϋ̀","8163":"Ϋ́","8164":"Ρ̓","8165":"Ῥ","8166":"Υ͂","8167":"Ϋ͂","8178":"ῺΙ","8179":"ΩΙ","8180":"ΏΙ","8182":"Ω͂","8183":"Ω͂Ι","8188":"ΩΙ","8526":"Ⅎ","8560":"Ⅰ","8561":"Ⅱ","8562":"Ⅲ","8563":"Ⅳ","8564":"Ⅴ","8565":"Ⅵ","8566":"Ⅶ","8567":"Ⅷ","8568":"Ⅸ","8569":"Ⅹ","8570":"Ⅺ","8571":"Ⅻ","8572":"Ⅼ","8573":"Ⅽ","8574":"Ⅾ","8575":"Ⅿ","8580":"Ↄ","9424":"Ⓐ","9425":"Ⓑ","9426":"Ⓒ","9427":"Ⓓ","9428":"Ⓔ","9429":"Ⓕ","9430":"Ⓖ","9431":"Ⓗ","9432":"Ⓘ","9433":"Ⓙ","9434":"Ⓚ","9435":"Ⓛ","9436":"Ⓜ","9437":"Ⓝ","9438":"Ⓞ","9439":"Ⓟ","9440":"Ⓠ","9441":"Ⓡ","9442":"Ⓢ","9443":"Ⓣ","9444":"Ⓤ","9445":"Ⓥ","9446":"Ⓦ","9447":"Ⓧ","9448":"Ⓨ","9449":"Ⓩ","11312":"Ⰰ","11313":"Ⰱ","11314":"Ⰲ","11315":"Ⰳ","11316":"Ⰴ","11317":"Ⰵ","11318":"Ⰶ","11319":"Ⰷ","11320":"Ⰸ","11321":"Ⰹ","11322":"Ⰺ","11323":"Ⰻ","11324":"Ⰼ","11325":"Ⰽ","11326":"Ⰾ","11327":"Ⰿ","11328":"Ⱀ","11329":"Ⱁ","11330":"Ⱂ","11331":"Ⱃ","11332":"Ⱄ","11333":"Ⱅ","11334":"Ⱆ","11335":"Ⱇ","11336":"Ⱈ","11337":"Ⱉ","11338":"Ⱊ","11339":"Ⱋ","11340":"Ⱌ","11341":"Ⱍ","11342":"Ⱎ","11343":"Ⱏ","11344":"Ⱐ","11345":"Ⱑ","11346":"Ⱒ","11347":"Ⱓ","11348":"Ⱔ","11349":"Ⱕ","11350":"Ⱖ","11351":"Ⱗ","11352":"Ⱘ","11353":"Ⱙ","11354":"Ⱚ","11355":"Ⱛ","11356":"Ⱜ","11357":"Ⱝ","11358":"Ⱞ","11359":"Ⱟ","11361":"Ⱡ","11365":"Ⱥ","11366":"Ⱦ","11368":"Ⱨ","11370":"Ⱪ","11372":"Ⱬ","11379":"Ⱳ","11382":"Ⱶ","11393":"Ⲁ","11395":"Ⲃ","11397":"Ⲅ","11399":"Ⲇ","11401":"Ⲉ","11403":"Ⲋ","11405":"Ⲍ","11407":"Ⲏ","11409":"Ⲑ","11411":"Ⲓ","11413":"Ⲕ","11415":"Ⲗ","11417":"Ⲙ","11419":"Ⲛ","11421":"Ⲝ","11423":"Ⲟ","11425":"Ⲡ","11427":"Ⲣ","11429":"Ⲥ","11431":"Ⲧ","11433":"Ⲩ","11435":"Ⲫ","11437":"Ⲭ","11439":"Ⲯ","11441":"Ⲱ","11443":"Ⲳ","11445":"Ⲵ","11447":"Ⲷ","11449":"Ⲹ","11451":"Ⲻ","11453":"Ⲽ","11455":"Ⲿ","11457":"Ⳁ","11459":"Ⳃ","11461":"Ⳅ","11463":"Ⳇ","11465":"Ⳉ","11467":"Ⳋ","11469":"Ⳍ","11471":"Ⳏ","11473":"Ⳑ","11475":"Ⳓ","11477":"Ⳕ","11479":"Ⳗ","11481":"Ⳙ","11483":"Ⳛ","11485":"Ⳝ","11487":"Ⳟ","11489":"Ⳡ","11491":"Ⳣ","11500":"Ⳬ","11502":"Ⳮ","11507":"Ⳳ","11520":"Ⴀ","11521":"Ⴁ","11522":"Ⴂ","11523":"Ⴃ","11524":"Ⴄ","11525":"Ⴅ","11526":"Ⴆ","11527":"Ⴇ","11528":"Ⴈ","11529":"Ⴉ","11530":"Ⴊ","11531":"Ⴋ","11532":"Ⴌ","11533":"Ⴍ","11534":"Ⴎ","11535":"Ⴏ","11536":"Ⴐ","11537":"Ⴑ","11538":"Ⴒ","11539":"Ⴓ","11540":"Ⴔ","11541":"Ⴕ","11542":"Ⴖ","11543":"Ⴗ","11544":"Ⴘ","11545":"Ⴙ","11546":"Ⴚ","11547":"Ⴛ","11548":"Ⴜ","11549":"Ⴝ","11550":"Ⴞ","11551":"Ⴟ","11552":"Ⴠ","11553":"Ⴡ","11554":"Ⴢ","11555":"Ⴣ","11556":"Ⴤ","11557":"Ⴥ","11559":"Ⴧ","11565":"Ⴭ","42561":"Ꙁ","42563":"Ꙃ","42565":"Ꙅ","42567":"Ꙇ","42569":"Ꙉ","42571":"Ꙋ","42573":"Ꙍ","42575":"Ꙏ","42577":"Ꙑ","42579":"Ꙓ","42581":"Ꙕ","42583":"Ꙗ","42585":"Ꙙ","42587":"Ꙛ","42589":"Ꙝ","42591":"Ꙟ","42593":"Ꙡ","42595":"Ꙣ","42597":"Ꙥ","42599":"Ꙧ","42601":"Ꙩ","42603":"Ꙫ","42605":"Ꙭ","42625":"Ꚁ","42627":"Ꚃ","42629":"Ꚅ","42631":"Ꚇ","42633":"Ꚉ","42635":"Ꚋ","42637":"Ꚍ","42639":"Ꚏ","42641":"Ꚑ","42643":"Ꚓ","42645":"Ꚕ","42647":"Ꚗ","42649":"Ꚙ","42651":"Ꚛ","42787":"Ꜣ","42789":"Ꜥ","42791":"Ꜧ","42793":"Ꜩ","42795":"Ꜫ","42797":"Ꜭ","42799":"Ꜯ","42803":"Ꜳ","42805":"Ꜵ","42807":"Ꜷ","42809":"Ꜹ","42811":"Ꜻ","42813":"Ꜽ","42815":"Ꜿ","42817":"Ꝁ","42819":"Ꝃ","42821":"Ꝅ","42823":"Ꝇ","42825":"Ꝉ","42827":"Ꝋ","42829":"Ꝍ","42831":"Ꝏ","42833":"Ꝑ","42835":"Ꝓ","42837":"Ꝕ","42839":"Ꝗ","42841":"Ꝙ","42843":"Ꝛ","42845":"Ꝝ","42847":"Ꝟ","42849":"Ꝡ","42851":"Ꝣ","42853":"Ꝥ","42855":"Ꝧ","42857":"Ꝩ","42859":"Ꝫ","42861":"Ꝭ","42863":"Ꝯ","42874":"Ꝺ","42876":"Ꝼ","42879":"Ꝿ","42881":"Ꞁ","42883":"Ꞃ","42885":"Ꞅ","42887":"Ꞇ","42892":"Ꞌ","42897":"Ꞑ","42899":"Ꞓ","42900":"Ꞔ","42903":"Ꞗ","42905":"Ꞙ","42907":"Ꞛ","42909":"Ꞝ","42911":"Ꞟ","42913":"Ꞡ","42915":"Ꞣ","42917":"Ꞥ","42919":"Ꞧ","42921":"Ꞩ","42933":"Ꞵ","42935":"Ꞷ","42937":"Ꞹ","42939":"Ꞻ","42941":"Ꞽ","42943":"Ꞿ","42945":"Ꟁ","42947":"Ꟃ","42952":"Ꟈ","42954":"Ꟊ","42957":"Ꟍ","42959":"꟎","42961":"Ꟑ","42963":"꟒","42965":"꟔","42967":"Ꟗ","42969":"Ꟙ","42971":"Ꟛ","42998":"Ꟶ","43859":"Ꭓ","43888":"Ꭰ","43889":"Ꭱ","43890":"Ꭲ","43891":"Ꭳ","43892":"Ꭴ","43893":"Ꭵ","43894":"Ꭶ","43895":"Ꭷ","43896":"Ꭸ","43897":"Ꭹ","43898":"Ꭺ","43899":"Ꭻ","43900":"Ꭼ","43901":"Ꭽ","43902":"Ꭾ","43903":"Ꭿ","43904":"Ꮀ","43905":"Ꮁ","43906":"Ꮂ","43907":"Ꮃ","43908":"Ꮄ","43909":"Ꮅ","43910":"Ꮆ","43911":"Ꮇ","43912":"Ꮈ","43913":"Ꮉ","43914":"Ꮊ","43915":"Ꮋ","43916":"Ꮌ","43917":"Ꮍ","43918":"Ꮎ","43919":"Ꮏ","43920":"Ꮐ","43921":"Ꮑ","43922":"Ꮒ","43923":"Ꮓ","43924":"Ꮔ","43925":"Ꮕ","43926":"Ꮖ","43927":"Ꮗ","43928":"Ꮘ","43929":"Ꮙ","43930":"Ꮚ","43931":"Ꮛ","43932":"Ꮜ","43933":"Ꮝ","43934":"Ꮞ","43935":"Ꮟ","43936":"Ꮠ","43937":"Ꮡ","43938":"Ꮢ","43939":"Ꮣ","43940":"Ꮤ","43941":"Ꮥ","43942":"Ꮦ","43943":"Ꮧ","43944":"Ꮨ","43945":"Ꮩ","43946":"Ꮪ","43947":"Ꮫ","43948":"Ꮬ","43949":"Ꮭ","43950":"Ꮮ","43951":"Ꮯ","43952":"Ꮰ","43953":"Ꮱ","43954":"Ꮲ","43955":"Ꮳ","43956":"Ꮴ","43957":"Ꮵ","43958":"Ꮶ","43959":"Ꮷ","43960":"Ꮸ","43961":"Ꮹ","43962":"Ꮺ","43963":"Ꮻ","43964":"Ꮼ","43965":"Ꮽ","43966":"Ꮾ","43967":"Ꮿ","64256":"FF","64257":"FI","64258":"FL","64259":"FFI","64260":"FFL","64261":"ST","64262":"ST","64275":"ՄՆ","64276":"ՄԵ","64277":"ՄԻ","64278":"ՎՆ","64279":"ՄԽ","65345":"Ａ","65346":"Ｂ","65347":"Ｃ","65348":"Ｄ","65349":"Ｅ","65350":"Ｆ","65351":"Ｇ","65352":"Ｈ","65353":"Ｉ","65354":"Ｊ","65355":"Ｋ","65356":"Ｌ","65357":"Ｍ","65358":"Ｎ","65359":"Ｏ","65360":"Ｐ","65361":"Ｑ","65362":"Ｒ","65363":"Ｓ","65364":"Ｔ","65365":"Ｕ","65366":"Ｖ","65367":"Ｗ","65368":"Ｘ","65369":"Ｙ","65370":"Ｚ","66600":"𐐀","66601":"𐐁","66602":"𐐂","66603":"𐐃","66604":"𐐄","66605":"𐐅","66606":"𐐆","66607":"𐐇","66608":"𐐈","66609":"𐐉","66610":"𐐊","66611":"𐐋","66612":"𐐌","66613":"𐐍","66614":"𐐎","66615":"𐐏","66616":"𐐐","66617":"𐐑","66618":"𐐒","66619":"𐐓","66620":"𐐔","66621":"𐐕","66622":"𐐖","66623":"𐐗","66624":"𐐘","66625":"𐐙","66626":"𐐚","66627":"𐐛","66628":"𐐜","66629":"𐐝","66630":"𐐞","66631":"𐐟","66632":"𐐠","66633":"𐐡","66634":"𐐢","66635":"𐐣","66636":"𐐤","66637":"𐐥","66638":"𐐦","66639":"𐐧","66776":"𐒰","66777":"𐒱","66778":"𐒲","66779":"𐒳","66780":"𐒴","66781":"𐒵","66782":"𐒶","66783":"𐒷","66784":"𐒸","66785":"𐒹","66786":"𐒺","66787":"𐒻","66788":"𐒼","66789":"𐒽","66790":"𐒾","66791":"𐒿","66792":"𐓀","66793":"𐓁","66794":"𐓂","66795":"𐓃","66796":"𐓄","66797":"𐓅","66798":"𐓆","66799":"𐓇","66800":"𐓈","66801":"𐓉","66802":"𐓊","66803":"𐓋","66804":"𐓌","66805":"𐓍","66806":"𐓎","66807":"𐓏","66808":"𐓐","66809":"𐓑","66810":"𐓒","66811":"𐓓","66967":"𐕰","66968":"𐕱","66969":"𐕲","66970":"𐕳","66971":"𐕴","66972":"𐕵","66973":"𐕶","66974":"𐕷","66975":"𐕸","66976":"𐕹","66977":"𐕺","66979":"𐕼","66980":"𐕽","66981":"𐕾","66982":"𐕿","66983":"𐖀","66984":"𐖁","66985":"𐖂","66986":"𐖃","66987":"𐖄","66988":"𐖅","66989":"𐖆","66990":"𐖇","66991":"𐖈","66992":"𐖉","66993":"𐖊","66995":"𐖌","66996":"𐖍","66997":"𐖎","66998":"𐖏","66999":"𐖐","67000":"𐖑","67001":"𐖒","67003":"𐖔","67004":"𐖕","68800":"𐲀","68801":"𐲁","68802":"𐲂","68803":"𐲃","68804":"𐲄","68805":"𐲅","68806":"𐲆","68807":"𐲇","68808":"𐲈","68809":"𐲉","68810":"𐲊","68811":"𐲋","68812":"𐲌","68813":"𐲍","68814":"𐲎","68815":"𐲏","68816":"𐲐","68817":"𐲑","68818":"𐲒","68819":"𐲓","68820":"𐲔","68821":"𐲕","68822":"𐲖","68823":"𐲗","68824":"𐲘","68825":"𐲙","68826":"𐲚","68827":"𐲛","68828":"𐲜","68829":"𐲝","68830":"𐲞","68831":"𐲟","68832":"𐲠","68833":"𐲡","68834":"𐲢","68835":"𐲣","68836":"𐲤","68837":"𐲥","68838":"𐲦","68839":"𐲧","68840":"𐲨","68841":"𐲩","68842":"𐲪","68843":"𐲫","68844":"𐲬","68845":"𐲭","68846":"𐲮","68847":"𐲯","68848":"𐲰","68849":"𐲱","68850":"𐲲","68976":"𐵐","68977":"𐵑","68978":"𐵒","68979":"𐵓","68980":"𐵔","68981":"𐵕","68982":"𐵖","68983":"𐵗","68984":"𐵘","68985":"𐵙","68986":"𐵚","68987":"𐵛","68988":"𐵜","68989":"𐵝","68990":"𐵞","68991":"𐵟","68992":"𐵠","68993":"𐵡","68994":"𐵢","68995":"𐵣","68996":"𐵤","68997":"𐵥","71872":"𑢠","71873":"𑢡","71874":"𑢢","71875":"𑢣","71876":"𑢤","71877":"𑢥","71878":"𑢦","71879":"𑢧","71880":"𑢨","71881":"𑢩","71882":"𑢪","71883":"𑢫","71884":"𑢬","71885":"𑢭","71886":"𑢮","71887":"𑢯","71888":"𑢰","71889":"𑢱","71890":"𑢲","71891":"𑢳","71892":"𑢴","71893":"𑢵","71894":"𑢶","71895":"𑢷","71896":"𑢸","71897":"𑢹","71898":"𑢺","71899":"𑢻","71900":"𑢼","71901":"𑢽","71902":"𑢾","71903":"𑢿","93792":"𖹀","93793":"𖹁","93794":"𖹂","93795":"𖹃","93796":"𖹄","93797":"𖹅","93798":"𖹆","93799":"𖹇","93800":"𖹈","93801":"𖹉","93802":"𖹊","93803":"𖹋","93804":"𖹌","93805":"𖹍","93806":"𖹎","93807":"𖹏","93808":"𖹐","93809":"𖹑","93810":"𖹒","93811":"𖹓","93812":"𖹔","93813":"𖹕","93814":"𖹖","93815":"𖹗","93816":"𖹘","93817":"𖹙","93818":"𖹚","93819":"𖹛","93820":"𖹜","93821":"𖹝","93822":"𖹞","93823":"𖹟","93883":"𖺠","93884":"𖺡","93885":"𖺢","93886":"𖺣","93887":"𖺤","93888":"𖺥","93889":"𖺦","93890":"𖺧","93891":"𖺨","93892":"𖺩","93893":"𖺪","93894":"𖺫","93895":"𖺬","93896":"𖺭","93897":"𖺮","93898":"𖺯","93899":"𖺰","93900":"𖺱","93901":"𖺲","93902":"𖺳","93903":"𖺴","93904":"𖺵","93905":"𖺶","93906":"𖺷","93907":"𖺸","125218":"𞤀","125219":"𞤁","125220":"𞤂","125221":"𞤃","125222":"𞤄","125223":"𞤅","125224":"𞤆","125225":"𞤇","125226":"𞤈","125227":"𞤉","125228":"𞤊","125229":"𞤋","125230":"𞤌","125231":"𞤍","125232":"𞤎","125233":"𞤏","125234":"𞤐","125235":"𞤑","125236":"𞤒","125237":"𞤓","125238":"𞤔","125239":"𞤕","125240":"𞤖","125241":"𞤗","125242":"𞤘","125243":"𞤙","125244":"𞤚","125245":"𞤛","125246":"𞤜","125247":"𞤝","125248":"𞤞","125249":"𞤟","125250":"𞤠","125251":"𞤡"}$zoe_upper_17$::jsonb;
    trimmed text := btrim(p_code, chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279));
    result text := '';
    original text;
    mapped text;
    character text;
    point integer;
    idx integer;
    inner_idx integer;
begin
    if p_code is null then
        return null;
    end if;
    for idx in 1..char_length(trimmed) loop
        original := substr(trimmed, idx, 1);
        point := ascii(original);
        mapped := coalesce(mappings ->> point::text, original);
        for inner_idx in 1..char_length(mapped) loop
            character := substr(mapped, inner_idx, 1);
            point := ascii(character);
            if point between 0 and 31 or point = any(array[35,36,37,46,47,91,93,127]) then
                result := result || '%' || translate(lpad(to_hex(point), 2, '0'), 'abcdef', 'ABCDEF');
            else
                result := result || character;
            end if;
        end loop;
    end loop;
    return result;
end
$$;

create function private.zoe_purge_integer_v1(p_value jsonb, p_min bigint default 0) returns boolean
language sql immutable set search_path = ''
as $$
    select case when jsonb_typeof(p_value) = 'number' then
        (p_value #>> '{}')::numeric between p_min and 9007199254740990
        and (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric)
    else false end
$$;

create function private.zoe_purge_text_v1(p_value jsonb, p_max integer) returns boolean
language sql immutable set search_path = ''
as $$
    select case when jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between 1 and p_max then
        (select coalesce(sum(case when ascii(c) > 65535 then 2 else 1 end), 0) <= p_max
         from regexp_split_to_table(p_value #>> '{}', '') c)
    else false end
$$;

create function private.zoe_purge_compact_v1(p_value jsonb) returns text
language plpgsql immutable set search_path = ''
as $$
declare
    result text;
begin
    case jsonb_typeof(p_value)
    when 'array' then
        select '[' || coalesce(string_agg(private.zoe_purge_compact_v1(e.value), ',' order by e.n), '') || ']'
        into result from jsonb_array_elements(p_value) with ordinality e(value, n);
        return result;
    when 'string' then return p_value::text;
    when 'number' then
        if not private.zoe_purge_integer_v1(p_value) then
            raise exception 'invalid-purge-packet' using errcode = '22023';
        end if;
        return ((p_value #>> '{}')::numeric)::bigint::text;
    else raise exception 'invalid-purge-packet' using errcode = '22023';
    end case;
end
$$;

create function private.zoe_purge_packet_v1(p_ops jsonb) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
    op jsonb;
    receipt jsonb;
    first_receipt jsonb;
    receipts jsonb;
    entries jsonb;
    source_id text;
    sources integer;
    count_rows integer;
    keys text[] := '{}'::text[];
    slots text[] := '{}'::text[];
    ids text[] := '{}'::text[];
    members jsonb[] := '{}'::jsonb[];
    preimage text;
    fields text[] := array['v','id','kind','actorUid','releasedBy','scope','code','registryKey','birth','trashId','slot','deletedAt','rowBirth','rowCount','generation'];
begin
    if jsonb_typeof(p_ops) is distinct from 'array' then
        raise exception 'invalid-purge-packet' using errcode = '22023';
    end if;
    if jsonb_array_length(p_ops) < 4 or octet_length(p_ops::text) > 4194304 then
        raise exception 'invalid-purge-packet' using errcode = '22023';
    end if;
    for op in select e.value from jsonb_array_elements(p_ops) e loop
        if jsonb_typeof(op) is distinct from 'object' or not (op ?& array['k','p','v'])
            or (select count(*) from jsonb_object_keys(op)) <> 3 or op ->> 'k' is distinct from 'set'
            or jsonb_typeof(op -> 'p') is distinct from 'array' then
            raise exception 'invalid-purge-packet' using errcode = '22023';
        end if;
        if jsonb_array_length(op -> 'p') <> 2
            or jsonb_typeof(op -> 'p' -> 0) is distinct from 'string'
            or jsonb_typeof(op -> 'p' -> 1) is distinct from 'string'
            or not private.zoe_key_ok(op -> 'p' ->> 0) or not private.zoe_key_ok(op -> 'p' ->> 1)
            or op -> 'p' ->> 0 not in ('zoew_recently_deleted_cod_dod','zoew_trash_consumptions','zoew_barcode_registry','zoew_registry_releases') then
            raise exception 'invalid-purge-packet' using errcode = '22023';
        end if;
    end loop;
    select count(distinct e.value -> 'p'), jsonb_object_agg((e.value -> 'p' ->> 0) || '/' || (e.value -> 'p' ->> 1), e.value -> 'v')
    into sources, entries from jsonb_array_elements(p_ops) e;
    if sources <> jsonb_array_length(p_ops) then
        raise exception 'invalid-purge-packet' using errcode = '22023';
    end if;
    select count(*), min(e.value -> 'p' ->> 1) into sources, source_id
    from jsonb_array_elements(p_ops) e where e.value -> 'p' ->> 0 = 'zoew_recently_deleted_cod_dod' and e.value -> 'v' = 'null'::jsonb;
    select coalesce(jsonb_agg(e.value -> 'v' order by (e.value -> 'v' ->> 'id') collate "C"), '[]'::jsonb)
    into receipts from jsonb_array_elements(p_ops) e where e.value -> 'p' ->> 0 = 'zoew_registry_releases';
    count_rows := jsonb_array_length(receipts);
    if sources <> 1 or source_id !~ '^[A-Za-z0-9_-]{1,128}$' or count_rows < 1
        or jsonb_array_length(p_ops) <> 2 + 2 * count_rows then
        raise exception 'invalid-purge-packet' using errcode = '22023';
    end if;
    first_receipt := receipts -> 0;
    for receipt in select e.value from jsonb_array_elements(receipts) e loop
        if jsonb_typeof(receipt) is distinct from 'object' or not (receipt ?& fields)
            or (select count(*) from jsonb_object_keys(receipt)) <> 15 or receipt -> 'v' is distinct from '2'::jsonb
            or not private.zoe_purge_integer_v1(receipt -> 'generation')
            or not private.zoe_purge_integer_v1(receipt -> 'birth', case when receipt ->> 'kind' = 'scan' then 1 else 0 end)
            or not private.zoe_purge_integer_v1(receipt -> 'deletedAt', 1)
            or not private.zoe_purge_integer_v1(receipt -> 'rowBirth')
            or not private.zoe_purge_integer_v1(receipt -> 'rowCount', 1)
            or not private.zoe_purge_text_v1(receipt -> 'id', 40)
            or not private.zoe_purge_text_v1(receipt -> 'actorUid', 2048)
            or not private.zoe_purge_text_v1(receipt -> 'releasedBy', 2048)
            or not private.zoe_purge_text_v1(receipt -> 'scope', 2048)
            or not private.zoe_purge_text_v1(receipt -> 'code', 256)
            or not private.zoe_purge_text_v1(receipt -> 'registryKey', 768)
            or (receipt ->> 'registryKey') collate "C" is distinct from private.zoe_purge_registry_key_v1(receipt ->> 'code') collate "C"
            or jsonb_typeof(receipt -> 'slot') is distinct from 'string'
            or receipt ->> 'slot' !~ '^(0|[1-9][0-9]{0,8})$'
            or not private.zoe_purge_text_v1(receipt -> 'trashId', 128)
            or receipt ->> 'trashId' is distinct from source_id
            or receipt -> 'rowCount' is distinct from to_jsonb(count_rows)
            or (receipt ->> 'id') = any(ids) or (receipt ->> 'registryKey') = any(keys) or (receipt ->> 'slot') = any(slots)
            or entries -> ('zoew_registry_releases/' || (receipt ->> 'id')) is distinct from receipt
            or entries -> ('zoew_barcode_registry/' || (receipt ->> 'registryKey')) is distinct from 'null'::jsonb then
            raise exception 'invalid-purge-packet' using errcode = '22023';
        end if;
        if ((receipt ->> 'kind' = 'scan' and receipt ->> 'id' ~ '^scan_[a-f0-9]{32}$')
            or (receipt ->> 'kind' = 'legacy' and receipt ->> 'id' ~ '^release_[a-f0-9]{32}$'
                and receipt -> 'actorUid' = receipt -> 'releasedBy')) is not true
            or (receipt - array['id','kind','actorUid','code','registryKey','birth','slot'])
                is distinct from (first_receipt - array['id','kind','actorUid','code','registryKey','birth','slot']) then
            raise exception 'invalid-purge-packet' using errcode = '22023';
        end if;
        ids := array_append(ids, receipt ->> 'id');
        keys := array_append(keys, receipt ->> 'registryKey');
        slots := array_append(slots, receipt ->> 'slot');
        members := array_append(members, jsonb_build_array(receipt -> 'id', receipt -> 'kind', receipt -> 'actorUid',
            receipt -> 'code', receipt -> 'registryKey', receipt -> 'birth', receipt -> 'slot'));
    end loop;
    if entries -> ('zoew_trash_consumptions/' || source_id) is distinct from jsonb_build_object('v', 1, 'sourceId', source_id,
        'generation', first_receipt -> 'generation', 'kind', 'purge', 'actorUid', first_receipt -> 'releasedBy',
        'scope', first_receipt -> 'scope', 'deletedAt', first_receipt -> 'deletedAt', 'rowBirth', first_receipt -> 'rowBirth') then
        raise exception 'invalid-purge-packet' using errcode = '22023';
    end if;
    preimage := private.zoe_purge_compact_v1(jsonb_build_array('zoew-registry-purge-v1', 2, source_id,
        first_receipt -> 'generation', first_receipt -> 'releasedBy', first_receipt -> 'scope', first_receipt -> 'deletedAt',
        first_receipt -> 'rowBirth', count_rows, to_jsonb(members)));
    return jsonb_build_object('v', 1, 'sourceId', source_id, 'generation', first_receipt -> 'generation',
        'actorUid', first_receipt -> 'releasedBy', 'scope', first_receipt -> 'scope', 'deletedAt', first_receipt -> 'deletedAt',
        'rowBirth', first_receipt -> 'rowBirth', 'rowCount', count_rows, 'receipts', receipts,
        'hash', encode(sha256(convert_to(preimage, 'UTF8')), 'hex'));
end
$$;

create function private.zoe_purge_binding_v1(p_packet jsonb, p_tenant uuid, p_op_id text, p_uid uuid, p_proof text) returns jsonb
language sql immutable set search_path = ''
as $$
    select jsonb_build_object('v', 1, 'outcome', case when p_proof = 'none' then 'unknown' else 'applied' end,
        'tenant', p_tenant, 'actorUid', p_uid, 'opId', p_op_id, 'hash', p_packet -> 'hash',
        'sourceId', p_packet -> 'sourceId', 'generation', p_packet -> 'generation', 'deletedAt', p_packet -> 'deletedAt',
        'rowBirth', p_packet -> 'rowBirth', 'rowCount', p_packet -> 'rowCount', 'proof', p_proof)
$$;

create function private.zoe_apply_engine_v1(p_tenant uuid, p_op_id text, p_ops jsonb, p_enforce boolean, p_replace boolean, p_purge jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
    prior_origin text := current_setting('zoe.internal_write', true);
    tenant uuid := p_tenant;
    now_ms bigint := private.zoe_now_ms();
    head bigint;
    used bigint;
    quota bigint;
    next_seq bigint;
    prior jsonb;
    op jsonb;
    kind text;
    op_path text[];
    doc_key text;
    want_keys text[] := '{}'::text[];
    root_names text[] := '{}'::text[];
    root_vals jsonb[] := '{}'::jsonb[];
    leaf_ops jsonb[] := '{}'::jsonb[];
    locs jsonb[] := '{}'::jsonb[];
    pre jsonb;
    pre_text text;
    pre_seq jsonb;
    pre_rows jsonb;
    work jsonb;
    rules jsonb;
    ctx jsonb;
    loc jsonb;
    loc_path text[];
    current_value jsonb;
    delta float8;
    new_value jsonb;
    changed boolean := false;
    cleanup_only boolean := not p_replace;
    grow bigint := 0;
    freed bigint;
    out_list jsonb[] := '{}'::jsonb[];
    stored_list jsonb[] := '{}'::jsonb[];
    result jsonb;
    ops_count integer;
    overlap boolean;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if jsonb_typeof(p_ops) <> 'array' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    ops_count := jsonb_array_length(p_ops);
    if ops_count < 1 or (ops_count > 500 and p_purge is null) or (p_purge is not null and (not p_enforce or p_replace)) then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if octet_length(p_ops::text) > 4194304 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;

    insert into public.zoe_tenant_state (tenant_id) values (tenant) on conflict (tenant_id) do nothing;
    select s.seq, s.bytes, s.quota_bytes into head, used, quota from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        return prior || jsonb_build_object('replayed', true, 'now', now_ms);
    end if;
    perform set_config('zoe.internal_write', 'on', true);
    next_seq := head + 1;
    if p_replace then
        select coalesce(sum(octet_length(z.value::text)), 0) into freed from public.zoe_docs z where z.tenant_id = tenant and z.value is not null;
        grow := grow - freed;
        update public.zoe_docs z set value = null, seq = next_seq, updated_at = now()
        where z.tenant_id = tenant and z.value is not null;
        changed := found;
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        if kind is null or kind not in ('set', 'inc', 'cas') then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind = 'cas' and ops_count <> 1 then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind <> 'inc' and not op ? 'v' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 and kind = 'inc' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        locs := array_append(locs, to_jsonb(op_path));
        if cardinality(op_path) = 1 then
            new_value := private.zoe_canon(op -> 'v');
            if not op_path[1] = any(root_names) then
                root_names := array_append(root_names, op_path[1]);
                root_vals := array_append(root_vals, new_value);
            end if;
            if jsonb_typeof(new_value) = 'object' then
                want_keys := want_keys || array(select op_path[1] || '/' || k from jsonb_object_keys(new_value) k);
            end if;
            continue;
        end if;
        want_keys := array_append(want_keys, op_path[1] || '/' || op_path[2]);
    end loop;

    with wanted as (
        select distinct split_part(w, '/', 1) as r, split_part(w, '/', 2) as k from unnest(want_keys) w
    ), by_root as (
        select z.root as r, z.key as k, z.value as v, z.seq as s from public.zoe_docs z
        where z.tenant_id = tenant and z.root = any(root_names)
        for update
    ), by_key as (
        select z.root as r, z.key as k, z.value as v, z.seq as s from public.zoe_docs z
        join wanted w on z.tenant_id = tenant and z.root = w.r and z.key = w.k
        where not (z.root = any(root_names))
        for update of z
    ), found_rows as (
        select * from by_root
        union all
        select * from by_key
    ), merged as (
        select f.r, f.k, f.v, f.s, true as row_exists from found_rows f
        union all
        select w.r, w.k, null::jsonb, 0::bigint, false from wanted w
        where not exists (select 1 from found_rows f where f.r = w.r and f.k = w.k)
    )
    select string_agg(to_json(m.r || '/' || m.k)::text || ':' || coalesce(m.v, 'null'::jsonb)::text, ','),
           coalesce(jsonb_object_agg(m.r || '/' || m.k, case when m.v is null then 0 else m.s end), '{}'::jsonb),
           coalesce(jsonb_object_agg(m.r || '/' || m.k, m.row_exists), '{}'::jsonb)
        into pre_text, pre_seq, pre_rows
    from merged m;
    if octet_length(pre_text) > 8388608 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;
    pre := coalesce(('{' || pre_text || '}')::jsonb, '{}'::jsonb);

    select exists (
        select 1 from (
            select t.a, lag(t.a) over (order by t.a) as b
            from (select array(select jsonb_array_elements_text(l)) as a from unnest(locs) l) t
        ) x
        where x.b is not null and cardinality(x.b) <= cardinality(x.a) and x.a[1:cardinality(x.b)] = x.b
    ) into overlap;
    if overlap then
        raise exception 'invalid_op' using errcode = '22023', detail = 'overlap';
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 then
            if kind = 'cas' then
                current_value := private.zoe_root_value(pre, op_path[1]);
                if current_value <> private.zoe_canon(op -> 'x') then
                    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
                    return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
                end if;
            end if;
            new_value := root_vals[array_position(root_names, op_path[1])];
            if new_value <> 'null'::jsonb and jsonb_typeof(new_value) <> 'object' then
                raise exception 'invalid_data' using errcode = '22023', detail = 'root';
            end if;
            continue;
        end if;
        doc_key := op_path[1] || '/' || op_path[2];
        if kind = 'set' then
            new_value := private.zoe_canon(op -> 'v');
        elsif kind = 'inc' then
            if jsonb_typeof(op -> 'd') <> 'number' then
                raise exception 'invalid_op' using errcode = '22023';
            end if;
            delta := (op ->> 'd')::float8;
            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);
            new_value := private.zoe_canon(to_jsonb(case when jsonb_typeof(current_value) = 'number' then (current_value #>> '{}')::float8 else 0::float8 end + delta));
        else
            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);
            if current_value <> private.zoe_canon(op -> 'x') then
                perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
                return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
            end if;
            new_value := private.zoe_canon(op -> 'v');
        end if;
        leaf_ops := array_append(leaf_ops, jsonb_build_object('d', doc_key, 's', to_jsonb(op_path[3:]), 'v', new_value));
    end loop;

    with leafs as (
        select l ->> 'd' as d, array_agg(l) as subs from unnest(leaf_ops) l group by 1
    ), roots as (
        select u.r, u.v from unnest(root_names, root_vals) as u(r, v)
    )
    select coalesce(('{' || string_agg(to_json(e.key)::text || ':' || (
        case when rt.r is not null then coalesce(rt.v -> split_part(e.key, '/', 2), 'null'::jsonb)
             when lf.d is not null then private.zoe_merge(e.value, lf.subs, 0)
             else e.value end)::text, ',') || '}')::jsonb, '{}'::jsonb)
        into work
    from jsonb_each(pre) e
    left join roots rt on rt.r = split_part(e.key, '/', 1)
    left join leafs lf on lf.d = e.key;

    for doc_key, new_value in select e.key, e.value from jsonb_each(work) e loop
        if octet_length(new_value::text) > 1048576 then
            raise exception 'invalid_data' using errcode = '22023', detail = 'size';
        end if;
        current_value := pre -> doc_key;
        if new_value = current_value then
            out_list := array_append(out_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
                'v', new_value, 's', (pre_seq ->> doc_key)::bigint));
            continue;
        end if;
        changed := true;
        cleanup_only := cleanup_only and current_value <> 'null'::jsonb and new_value = 'null'::jsonb;
        grow := grow + case when new_value = 'null'::jsonb then 0 else octet_length(new_value::text) end
            - case when current_value = 'null'::jsonb then 0 else octet_length(current_value::text) end
            + case when (pre_rows ->> doc_key)::boolean then 0 else private.zoe_doc_bytes(split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), null) end;
        insert into public.zoe_docs as z (tenant_id, root, key, value, seq, updated_at)
        values (tenant, split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), nullif(new_value, 'null'::jsonb), next_seq, now())
        on conflict (tenant_id, root, key) do update
            set value = excluded.value, seq = excluded.seq, updated_at = excluded.updated_at;
        out_list := array_append(out_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
            'v', new_value, 's', next_seq));
        stored_list := array_append(stored_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2), 's', next_seq));
    end loop;

    if p_enforce then
        rules := private.zoe_rules();
        ctx := jsonb_build_object('t', tenant, 'now', now_ms, 'pre', pre, 'post', work,
            'touched', (select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) from jsonb_object_keys(pre) k));
        foreach loc in array locs loop
            loc_path := array(select jsonb_array_elements_text(loc));
            if not private.zoe_check_location(rules, loc_path, ctx) then
                raise exception 'permission_denied' using errcode = '42501', detail = array_to_string(loc_path, '/');
            end if;
        end loop;
    end if;

    if not changed then
        next_seq := head;
    end if;
    result := jsonb_build_object('ok', true, 'seq', next_seq, 'docs', private.zoe_json_array(stored_list));
    if p_purge is not null then
        result := result || jsonb_build_object('purge', p_purge);
    end if;
    grow := grow + private.zoe_op_bytes(p_op_id, result);
    if p_enforce and grow > 0 and used::numeric + grow > quota then
        perform private.zoe_housekeeping(tenant);
        select s.bytes into used from public.zoe_tenant_state s where s.tenant_id = tenant;
        if used::numeric + grow > quota and not (changed and cleanup_only and used::numeric + grow - quota <= 1048576) then
            raise exception 'quota_exceeded' using errcode = '22023', detail = 'bytes';
        end if;
    end if;
    update public.zoe_tenant_state s set seq = next_seq, bytes = greatest(s.bytes + grow, 0) where s.tenant_id = tenant;
    insert into public.zoe_ops (tenant_id, op_id, result) values (tenant, p_op_id, result);
    if changed and next_seq % 64 = 0 then
        perform private.zoe_housekeeping(tenant);
    end if;
    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
    return jsonb_build_object('ok', true, 'seq', next_seq, 'now', now_ms, 'docs', private.zoe_json_array(out_list))
        || case when p_purge is null then '{}'::jsonb else jsonb_build_object('purge', p_purge) end;
exception when others then
    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);
    raise;
end
$$;

create or replace function private.zoe_apply(p_tenant uuid, p_op_id text, p_ops jsonb, p_enforce boolean, p_replace boolean) returns jsonb
language sql volatile set search_path = ''
as $$
    select private.zoe_apply_engine_v1(p_tenant, p_op_id, p_ops, p_enforce, p_replace, null)
$$;

create function private.zoe_purge_source_v1(p_tenant uuid, p_packet jsonb) returns void
language plpgsql volatile set search_path = ''
as $$
declare
    source jsonb;
    barcodes jsonb;
    receipt_by_slot jsonb;
    receipt jsonb;
    barcode jsonb;
    slot text;
    birth jsonb;
    row_birth jsonb;
    generation jsonb;
    count_rows integer := 0;
begin
    select d.value into source from public.zoe_docs d
    where d.tenant_id = p_tenant and d.root = 'zoew_recently_deleted_cod_dod' and d.key = p_packet ->> 'sourceId'
    for update;
    if jsonb_typeof(source) is distinct from 'object' then
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    row_birth := case when source -> 'createdAt' is null or source -> 'createdAt' = 'null'::jsonb then '0'::jsonb else source -> 'createdAt' end;
    generation := case when source ? 'trashGeneration' then source -> 'trashGeneration' else '0'::jsonb end;
    if source -> 'deletedAt' is distinct from p_packet -> 'deletedAt' or row_birth is distinct from p_packet -> 'rowBirth'
        or generation is distinct from p_packet -> 'generation' or source -> 'count' is distinct from p_packet -> 'rowCount' then
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    if jsonb_typeof(source -> 'barcodes') = 'object' then
        barcodes := source -> 'barcodes';
    elsif jsonb_typeof(source -> 'barcodes') = 'array' then
        select coalesce(jsonb_object_agg((e.n - 1)::text, e.value), '{}'::jsonb) into barcodes
        from jsonb_array_elements(source -> 'barcodes') with ordinality e(value, n);
    else
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
    select jsonb_object_agg(e.value ->> 'slot', e.value) into receipt_by_slot
    from jsonb_array_elements(p_packet -> 'receipts') e;
    for slot, barcode in select e.key, e.value from jsonb_each(barcodes) e loop
        if slot !~ '^(0|[1-9][0-9]{0,8})$' then
            raise exception 'purge-source-conflict' using errcode = 'PT409';
        end if;
        if barcode = 'null'::jsonb then
            continue;
        end if;
        count_rows := count_rows + 1;
        receipt := receipt_by_slot -> slot;
        birth := case when barcode -> 'createdAt' is null or barcode -> 'createdAt' = 'null'::jsonb then '0'::jsonb else barcode -> 'createdAt' end;
        if jsonb_typeof(barcode) is distinct from 'object' or receipt is null
            or barcode -> 'code' is distinct from receipt -> 'code' or birth is distinct from receipt -> 'birth'
            or (barcode ? 'scanIntent' and (receipt ->> 'kind' is distinct from 'scan' or barcode -> 'scanIntent' is distinct from receipt -> 'id'))
            or (not (barcode ? 'scanIntent') and receipt ->> 'kind' is distinct from 'legacy') then
            raise exception 'purge-source-conflict' using errcode = 'PT409';
        end if;
    end loop;
    if to_jsonb(count_rows) is distinct from p_packet -> 'rowCount' then
        raise exception 'purge-source-conflict' using errcode = 'PT409';
    end if;
end
$$;

create function private.zoe_purge_execute_v1(p_expected_tenant uuid, p_op_id text, p_ops jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    member_tenant uuid;
    tenant uuid;
    packet jsonb;
    binding jsonb;
    prior jsonb;
    head bigint;
begin
    if uid is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid-op-id' using errcode = '22023';
    end if;
    select m.tenant_id into member_tenant from public.tenant_members m where m.user_id = uid for share;
    tenant := private.current_tenant_id();
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_expected_tenant is null or tenant <> p_expected_tenant or member_tenant is distinct from tenant then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    packet := private.zoe_purge_packet_v1(p_ops);
    if packet ->> 'actorUid' is distinct from uid::text then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    binding := private.zoe_purge_binding_v1(packet, tenant, p_op_id, uid, 'operation');
    insert into public.zoe_tenant_state (tenant_id) values (tenant) on conflict (tenant_id) do nothing;
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        if prior -> 'purge' is distinct from binding or prior -> 'ok' is distinct from 'true'::jsonb then
            raise exception 'purge-context-conflict' using errcode = 'PT409';
        end if;
        return jsonb_build_object('ok', true, 'seq', head, 'docs', '[]'::jsonb, 'now', private.zoe_now_ms(), 'replayed', true, 'purge', binding);
    end if;
    perform private.zoe_purge_source_v1(tenant, packet);
    return private.zoe_apply_engine_v1(tenant, p_op_id, p_ops, true, false, binding);
end
$$;

create function private.zoe_purge_status_v1(p_expected_tenant uuid, p_op_id text, p_ops jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    member_tenant uuid;
    tenant uuid;
    packet jsonb;
    binding jsonb;
    prior jsonb;
    head bigint;
    complete boolean;
begin
    if uid is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid-op-id' using errcode = '22023';
    end if;
    select m.tenant_id into member_tenant from public.tenant_members m where m.user_id = uid for share;
    tenant := private.current_tenant_id();
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_expected_tenant is null or tenant <> p_expected_tenant or member_tenant is distinct from tenant then
        raise exception 'tenant-mismatch' using errcode = 'PT409';
    end if;
    packet := private.zoe_purge_packet_v1(p_ops);
    if packet ->> 'actorUid' is distinct from uid::text then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    binding := private.zoe_purge_binding_v1(packet, tenant, p_op_id, uid, 'operation');
    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for share;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        if prior -> 'purge' is distinct from binding or prior -> 'ok' is distinct from 'true'::jsonb then
            raise exception 'purge-context-conflict' using errcode = 'PT409';
        end if;
    else
        select not exists (
            select 1 from jsonb_array_elements(packet -> 'receipts') r
            left join public.zoe_docs d on d.tenant_id = tenant and d.root = 'zoew_registry_releases' and d.key = r.value ->> 'id'
            where d.value is distinct from r.value
        ) into complete;
        binding := private.zoe_purge_binding_v1(packet, tenant, p_op_id, uid, case when complete then 'release-set' else 'none' end);
    end if;
    return jsonb_build_object('ok', true, 'seq', coalesce(head, 0), 'docs', '[]'::jsonb, 'now', private.zoe_now_ms(), 'purge', binding);
end
$$;

create function public.zoe_purge_execute_v1(p_expected_tenant uuid, p_op_id text, p_ops jsonb) returns jsonb
language sql volatile security invoker set search_path = ''
as $$
    select private.zoe_purge_execute_v1(p_expected_tenant, p_op_id, p_ops)
$$;

create function public.zoe_purge_status_v1(p_expected_tenant uuid, p_op_id text, p_ops jsonb) returns jsonb
language sql volatile security invoker set search_path = ''
as $$
    select private.zoe_purge_status_v1(p_expected_tenant, p_op_id, p_ops)
$$;

revoke all on function private.zoe_purge_source_v1(uuid, jsonb), private.zoe_purge_registry_key_v1(text),
    private.zoe_purge_integer_v1(jsonb, bigint), private.zoe_purge_text_v1(jsonb, integer),
    private.zoe_purge_compact_v1(jsonb), private.zoe_purge_packet_v1(jsonb),
    private.zoe_purge_binding_v1(jsonb, uuid, text, uuid, text),
    private.zoe_apply_engine_v1(uuid, text, jsonb, boolean, boolean, jsonb)
    from public, anon, authenticated, service_role;
revoke all on function private.zoe_purge_execute_v1(uuid, text, jsonb), private.zoe_purge_status_v1(uuid, text, jsonb),
    public.zoe_purge_execute_v1(uuid, text, jsonb), public.zoe_purge_status_v1(uuid, text, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function private.zoe_purge_execute_v1(uuid, text, jsonb), private.zoe_purge_status_v1(uuid, text, jsonb),
    public.zoe_purge_execute_v1(uuid, text, jsonb), public.zoe_purge_status_v1(uuid, text, jsonb)
    to authenticated;

notify pgrst, 'reload schema';
