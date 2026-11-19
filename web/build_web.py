#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 notes.html / notes2.html 生成 web/index.html、web/m1.html、web/m2.html"""
import re, json, pathlib, html as H, base64

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = pathlib.Path(__file__).resolve().parent

def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()

def explain(rest):
    rest = rest.strip()
    rest = re.sub(r"^——", "", rest).strip()
    m = re.match(r"^（([^）]{2,})）", rest)
    if m:
        rest = m.group(1) + rest[m.end():]
    rest = rest.split("；")[0].split("。")[0]
    return rest[:130]

def quiz_from(part):
    items, seen = [], set()
    for wh in re.findall(r'<div class="bx warn">.*?</div>', part, re.S):
        t = strip_tags(wh)
        found = False
        for m in re.finditer(r"「([^「」]{5,})」\s*([×√])", t):
            q = m.group(1).strip()
            if 8 <= len(q) <= 70 and q not in seen:
                seen.add(q); items.append({"q": q, "a": m.group(2) == "√", "e": explain(t[m.end():])})
            found = True
        if not found:
            m = re.search(r"(.{10,60}?)\s*([×√])\s*(?=——|（|$|；|。)", t)
            if m:
                q = m.group(1).strip().lstrip("「").rstrip("」")
                if q not in seen and len(q) >= 8:
                    seen.add(q); items.append({"q": q, "a": m.group(2) == "√", "e": explain(t[m.end():])})
    return items

def cards_from(part):
    seen, out = set(), []
    for m in re.finditer(r'<div class="fcard">(.*?)</div>', part, re.S):
        block = m.group(1)
        bm = re.search(r"<b>(.*?)</b>", block, re.S)
        fm = re.search(r'<span class="fm">(.*?)</span>', block, re.S)
        if not (bm and fm):
            continue
        t = strip_tags(bm.group(1))
        if 2 <= len(t) <= 24 and t not in seen:
            seen.add(t)
            out.append({"t": t, "c": strip_tags(fm.group(1))[:110]})
    for m in re.finditer(r"<(li|td)>(.*?)</\1>", part, re.S):
        block = m.group(2)
        for km in re.finditer(r'<span class="k">(.*?)</span>', block, re.S):
            term = strip_tags(km.group(1))
            if 2 <= len(term) <= 24 and term not in seen:
                seen.add(term)
                ctx = strip_tags(block)
                if len(ctx) > 110: ctx = ctx[:110] + "…"
                out.append({"t": term, "c": ctx})
    return out

# ---------- 必修2 判断题库（手工编写，逐条对照 notes2.html 核验） ----------
M2QUIZ = [
    {"q": "1 个精原细胞经减数分裂可产生 4 种精子", "a": False, "e": "两两相同、互补，实为 2 种 4 个", "ch": 0},
    {"q": "减Ⅱ后期着丝粒分裂，染色体数目暂时加倍", "a": True, "e": "减Ⅱ全程无同源染色体", "ch": 0},
    {"q": "减Ⅰ同源染色体未分离，产生的 4 个配子全部异常", "a": True, "e": "减Ⅱ异常则只有一半配子异常", "ch": 0},
    {"q": "减Ⅱ着丝粒分裂后单体未移向两极，4 个配子同样全部异常", "a": False, "e": "2 个正常、2 个异常", "ch": 0},
    {"q": "受精卵的染色体数目恢复到本物种体细胞数目", "a": True, "e": "减数分裂减半 + 受精恢复，维持前后代染色体数目恒定", "ch": 0},
    {"q": "杂合子 Aa 自交后代的性状分离比为 3:1", "a": True, "e": "", "ch": 1},
    {"q": "杂合子测交后代的显隐比为 3:1", "a": False, "e": "测交后代为 1:1，比例反映被测个体配子种类及比例", "ch": 1},
    {"q": "显性纯合致死时，杂合子自交后代显:隐 = 2:1", "a": True, "e": "AA 致死，存活个体为 Aa:aa = 2:1", "ch": 1},
    {"q": "隐性纯合致死时，杂合子自交后代全为隐性", "a": False, "e": "后代全为显性", "ch": 1},
    {"q": "非同源染色体上的非等位基因自由组合发生在减Ⅰ后期", "a": True, "e": "", "ch": 2},
    {"q": "AaBb 测交后代四种表现型的比例为 9:3:3:1", "a": False, "e": "测交为 1:1:1:1；9:3:3:1 是自交结果", "ch": 2},
    {"q": "不考虑互换，n 对同源染色体的个体可产生 2ⁿ 种配子", "a": True, "e": "", "ch": 2},
    {"q": "红绿色盲是伴 X 染色体隐性遗传病", "a": True, "e": "男患者多于女患者，存在交叉遗传", "ch": 3},
    {"q": "抗维生素 D 佝偻病是常染色体显性遗传病", "a": False, "e": "伴 X 染色体显性遗传，女多于男、世代连续", "ch": 3},
    {"q": "调查遗传病发病率应在患者家系中抽样", "a": False, "e": "发病率在广大人群中随机抽样；家系调查用于确定遗传方式", "ch": 3},
    {"q": "噬菌体侵染细菌实验证明 DNA 是遗传物质", "a": True, "e": "", "ch": 4},
    {"q": "TMV 实验证明 RNA 是烟草花叶病毒的遗传物质", "a": True, "e": "RNA 病毒的基因在 RNA 上", "ch": 4},
    {"q": "所有生物的遗传物质都是 DNA", "a": False, "e": "RNA 病毒以 RNA 为遗传物质，故称 DNA 是主要的遗传物质", "ch": 4},
    {"q": "DNA 双链中每个磷酸基团都连接 2 个脱氧核糖", "a": False, "e": "每个磷酸连接 1~2 个脱氧核糖，两端 2 个游离磷酸各只连 1 个", "ch": 5},
    {"q": "DNA 复制 n 代后共 2ⁿ 个 DNA，含亲代链的只有 2 个", "a": True, "e": "半保留复制", "ch": 5},
    {"q": "人类基因组测序需测定 24 条染色体", "a": True, "e": "22 条常染色体 + X + Y", "ch": 5},
    {"q": "翻译的直接模板是 DNA", "a": False, "e": "翻译模板是 mRNA", "ch": 6},
    {"q": "密码子位于 mRNA 上，反密码子位于 tRNA 上", "a": True, "e": "", "ch": 6},
    {"q": "中心法则包括 DNA 复制、转录和翻译等信息传递过程", "a": True, "e": "", "ch": 6},
    {"q": "基因突变能产生新基因，是生物变异的根本来源", "a": True, "e": "为生物进化提供原材料", "ch": 7},
    {"q": "秋水仙素诱导多倍体的原理是抑制纺锤体形成", "a": True, "e": "作用于分裂前期；诱导基因突变则作用于间期", "ch": 7},
    {"q": "21 三体综合征是由基因突变引起的遗传病", "a": False, "e": "染色体异常遗传病（体细胞多一条 21 号染色体）", "ch": 7},
    {"q": "单倍体的体细胞染色体数目与本物种配子相同", "a": True, "e": "", "ch": 7},
    {"q": "受精作用过程中会发生基因重组", "a": False, "e": "基因重组不发生在受精作用中", "ch": 7},
    {"q": "生物进化的基本单位是种群", "a": True, "e": "", "ch": 8},
    {"q": "生物进化的实质是种群基因频率的改变", "a": True, "e": "自然选择使基因频率定向改变", "ch": 8},
    {"q": "共同进化只发生在不同物种之间", "a": False, "e": "还包括生物与无机环境之间", "ch": 8},
    {"q": "新物种形成的标志是产生生殖隔离", "a": True, "e": "隔离是物种形成的必要条件", "ch": 8},
]

def parse_book(fname, book_id, label, badge, sub):
    src = (ROOT / fname).read_text(encoding="utf-8")
    body = src.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    body = re.sub(r'class="(warn|note|exam|exp)"', r'class="bx \1"', body)
    chunks = [c for c in re.split(r'(?=<section class="chapter")', body) if c.startswith('<section class="chapter"')]
    chapters, quiz, cards, search = [], [], [], []
    for i, c in enumerate(chunks):
        c = c.split("</section>")[0] + "</section>"
        n = strip_tags(re.search(r'<div class="ch-num">([^<]*)</div>', c).group(1))
        t = strip_tags(re.search(r"<h1>([^<]+)</h1>", c).group(1))
        subs = re.search(r'<p class="ch-sub">(.*?)</p>', c, re.S)
        sub_t = strip_tags(subs.group(1)) if subs else ""
        qs = quiz_from(c)
        cs = cards_from(c)
        # search index
        h2s = [(m.group(1), m.start()) for m in re.finditer(r"<h2>(.*?)</h2>", c)]
        head = strip_tags(c[:h2s[0][1]]) if h2s else strip_tags(c)
        search.append({"id": f"c{i}", "ch": i, "chT": t, "t": t, "terms": "", "x": head[:380]})
        for k, (ht, st) in enumerate(h2s):
            end = h2s[k + 1][1] if k + 1 < len(h2s) else len(c)
            chunk = c[st:end]
            terms = " ".join(dict.fromkeys(strip_tags(x) for x in re.findall(r'<span class="k">(.*?)</span>', chunk, re.S)))
            search.append({"id": f"c{i}s{k}", "ch": i, "chT": t, "t": strip_tags(ht), "terms": terms[:200], "x": strip_tags(chunk)[:420]})
        quiz.extend([{**q, "ch": i} for q in qs])
        cards.extend([{**cd, "ch": i} for cd in cs])
        chapters.append({"n": n, "t": t, "s": sub_t, "secs": [strip_tags(h) for h, _ in h2s]})
    return {"id": book_id, "label": label, "badge": badge, "sub": sub,
            "chapters": chapters, "quiz": quiz, "cards": cards, "search": search}

def content_html(fname):
    src = (ROOT / fname).read_text(encoding="utf-8")
    body = src.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    body = re.sub(r'class="(warn|note|exam|exp)"', r'class="bx \1"', body)
    chunks = [c for c in re.split(r'(?=<section class="chapter")', body) if c.startswith('<section class="chapter"')]
    return "\n".join(c.split("</section>")[0] + "</section>" for c in chunks)

def jdump(obj):
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")

def b64img(name):
    p = WEB / "assets" / name
    if not p.exists():
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()

# ---------- 知识点互链表（t=触发词 v=变体 b=目标册 c=目标章 s=目标节(None=章首)） ----------
XREFS = [
    {"t": "减数分裂", "b": "m2", "c": 0, "s": 1}, {"t": "受精作用", "b": "m2", "c": 0, "s": 3},
    {"t": "四分体", "b": "m2", "c": 0, "s": 1}, {"t": "同源染色体", "b": "m2", "c": 0, "s": 1},
    {"t": "等位基因", "b": "m2", "c": 1, "s": 2}, {"t": "假说-演绎法", "v": ["假说—演绎法"], "b": "m2", "c": 1, "s": 1},
    {"t": "性状分离", "b": "m2", "c": 1, "s": 2}, {"t": "测交", "b": "m2", "c": 1, "s": 2},
    {"t": "自由组合定律", "b": "m2", "c": 2}, {"t": "自由组合", "b": "m2", "c": 2},
    {"t": "连锁", "b": "m2", "c": 2, "s": 5}, {"t": "互换", "b": "m2", "c": 2, "s": 5},
    {"t": "伴性遗传", "b": "m2", "c": 3, "s": 2}, {"t": "性染色体", "b": "m2", "c": 3, "s": 2},
    {"t": "血友病", "b": "m2", "c": 3, "s": 4}, {"t": "系谱图", "b": "m2", "c": 3, "s": 3},
    {"t": "肺炎链球菌", "b": "m2", "c": 4, "s": 0}, {"t": "噬菌体", "b": "m2", "c": 4, "s": 1},
    {"t": "烟草花叶病毒", "b": "m2", "c": 4, "s": 2},
    {"t": "DNA 复制", "v": ["DNA复制", "DNA 的复制"], "b": "m2", "c": 5, "s": 3},
    {"t": "解旋酶", "b": "m2", "c": 5, "s": 3}, {"t": "碱基互补配对", "b": "m2", "c": 5, "s": 0},
    {"t": "双螺旋", "b": "m2", "c": 5, "s": 0},
    {"t": "反密码子", "b": "m2", "c": 6, "s": 0}, {"t": "密码子", "b": "m2", "c": 6, "s": 0},
    {"t": "转录", "b": "m2", "c": 6, "s": 1}, {"t": "翻译", "b": "m2", "c": 6, "s": 2},
    {"t": "中心法则", "b": "m2", "c": 6, "s": 3}, {"t": "表观遗传", "b": "m2", "c": 6, "s": 5},
    {"t": "基因突变", "b": "m2", "c": 7, "s": 0}, {"t": "基因重组", "b": "m2", "c": 7, "s": 1},
    {"t": "染色体变异", "b": "m2", "c": 7, "s": 2}, {"t": "染色体组", "b": "m2", "c": 7, "s": 4},
    {"t": "单倍体", "b": "m2", "c": 7, "s": 4}, {"t": "多倍体", "b": "m2", "c": 7, "s": 4},
    {"t": "花药离体培养", "b": "m2", "c": 7, "s": 4}, {"t": "秋水仙素", "b": "m1", "c": 10, "s": 4},
    {"t": "杂交育种", "b": "m2", "c": 7, "s": 5}, {"t": "诱变育种", "b": "m2", "c": 7, "s": 5},
    {"t": "基因频率", "b": "m2", "c": 8, "s": 5}, {"t": "基因库", "b": "m2", "c": 8, "s": 5},
    {"t": "遗传漂变", "b": "m2", "c": 8, "s": 5}, {"t": "生殖隔离", "b": "m2", "c": 8, "s": 6},
    {"t": "地理隔离", "b": "m2", "c": 8, "s": 6}, {"t": "自然选择", "b": "m2", "c": 8, "s": 4},
    {"t": "协同进化", "b": "m2", "c": 8, "s": 7},
    {"t": "有丝分裂", "b": "m1", "c": 10, "s": 1}, {"t": "姐妹染色单体", "b": "m1", "c": 10, "s": 1},
    {"t": "着丝粒", "b": "m1", "c": 10, "s": 1}, {"t": "纺锤体", "b": "m1", "c": 10, "s": 1},
    {"t": "细胞周期", "b": "m1", "c": 10, "s": 0},
    {"t": "细胞分化", "b": "m1", "c": 11, "s": 0}, {"t": "全能性", "b": "m1", "c": 11, "s": 1},
    {"t": "细胞凋亡", "b": "m1", "c": 11, "s": 3}, {"t": "细胞衰老", "b": "m1", "c": 11, "s": 2},
    {"t": "端粒", "b": "m1", "c": 11, "s": 2}, {"t": "自由基", "b": "m1", "c": 11, "s": 2},
    {"t": "癌细胞", "b": "m2", "c": 7, "s": 0},
    {"t": "有氧呼吸", "b": "m1", "c": 8, "s": 2}, {"t": "无氧呼吸", "b": "m1", "c": 8, "s": 3},
    {"t": "细胞呼吸", "b": "m1", "c": 8}, {"t": "光反应", "b": "m1", "c": 9, "s": 2},
    {"t": "暗反应", "b": "m1", "c": 9, "s": 2}, {"t": "类囊体", "b": "m1", "c": 9, "s": 0},
    {"t": "化能合成", "b": "m1", "c": 9, "s": 5},
    {"t": "主动运输", "b": "m1", "c": 6, "s": 3}, {"t": "自由扩散", "b": "m1", "c": 6, "s": 3},
    {"t": "协助扩散", "b": "m1", "c": 6, "s": 3}, {"t": "胞吐", "b": "m1", "c": 6, "s": 3},
    {"t": "胞吞", "b": "m1", "c": 6, "s": 3}, {"t": "载体蛋白", "b": "m1", "c": 6, "s": 3},
    {"t": "通道蛋白", "b": "m1", "c": 6, "s": 3}, {"t": "质壁分离", "b": "m1", "c": 6, "s": 2},
    {"t": "渗透作用", "b": "m1", "c": 6, "s": 0}, {"t": "半透膜", "b": "m1", "c": 6, "s": 0},
    {"t": "核糖体", "b": "m1", "c": 5, "s": 1}, {"t": "线粒体", "b": "m1", "c": 5, "s": 2},
    {"t": "叶绿体", "b": "m1", "c": 5, "s": 2}, {"t": "高尔基体", "b": "m1", "c": 5, "s": 1},
    {"t": "溶酶体", "b": "m1", "c": 5, "s": 1}, {"t": "中心体", "b": "m1", "c": 5, "s": 1},
    {"t": "内质网", "b": "m1", "c": 5, "s": 1}, {"t": "分泌蛋白", "b": "m1", "c": 5, "s": 3},
    {"t": "生物膜系统", "b": "m1", "c": 5, "s": 4},
    {"t": "流动镶嵌模型", "b": "m1", "c": 4, "s": 2}, {"t": "细胞膜", "b": "m1", "c": 4, "s": 2},
    {"t": "细胞核", "b": "m1", "c": 4, "s": 4}, {"t": "核孔", "b": "m1", "c": 4, "s": 4},
    {"t": "细胞壁", "b": "m1", "c": 4, "s": 3},
    {"t": "脱水缩合", "b": "m1", "c": 3, "s": 0}, {"t": "肽键", "b": "m1", "c": 3, "s": 0},
    {"t": "必需氨基酸", "b": "m1", "c": 3, "s": 0}, {"t": "核酸", "b": "m1", "c": 3, "s": 1},
    {"t": "斐林试剂", "b": "m1", "c": 1, "s": 1}, {"t": "双缩脲", "b": "m1", "c": 1, "s": 1},
    {"t": "还原糖", "b": "m1", "c": 1, "s": 1},
    {"t": "ATP", "b": "m1", "c": 7, "s": 4},
]
# ---------- 校验 xref 目标 ----------
def validate_xrefs(books):
    bad = []
    for x in XREFS:
        bk = books.get(x["b"])
        if bk is None or x["c"] >= len(bk["chapters"]):
            bad.append(x); continue
        if x.get("s") is not None and x["s"] >= len(bk["chapters"][x["c"]]["secs"]):
            bad.append(x)
    return bad

CSS = (WEB / "app.css").read_text(encoding="utf-8")
JS = (WEB / "app.js").read_text(encoding="utf-8")

MODELS = '''<div class="mask" id="mask"></div>
<div id="puppy-run"><div class="run-sprite"></div></div>
<div class="modal" id="m-quiz">
  <h3>判断快测<button class="m-close">✕</button></h3>
  <div class="sel-row" id="qz-chips"></div>
  <div class="qz-meta" id="qz-meta">点击上方章节标签开始练习，每轮 10 题</div>
  <div class="qz-stem" id="qz-stem">每题给出一个说法，判断它正确（√）还是错误（×），答完立即显示解析。</div>
  <div class="qz-btns" id="qz-btns" style="display:none"><button id="qz-yes">√ 对</button><button id="qz-no">× 错</button></div>
  <div class="qz-fb" id="qz-fb"></div>
  <button class="qz-next" id="qz-next">下一题</button>
</div>
<div class="modal" id="m-cards">
  <h3>闪卡自测<button class="m-close">✕</button></h3>
  <div class="sel-row" id="fc-chips"></div>
  <div class="qz-meta" id="fc-meta">点击上方章节标签开始</div>
  <div class="fc-box" id="fc-box"><div class="fc-card"><div class="fc-face"><div class="fc-term">正面：知识点</div><div class="fc-hint">点击卡片翻转查看解释</div></div><div class="fc-face back"><div>背面：所在条目原文</div></div></div></div>
  <div class="fc-btns" id="fc-btns" style="display:none"><button class="no" id="fc-no">没记住</button><button class="yes" id="fc-yes">记住了</button></div>
</div>
<div class="modal" id="m-search">
  <h3>搜索知识点&nbsp;<kbd>Ctrl</kbd> <kbd>K</kbd><button class="m-close">✕</button></h3>
  <input class="sp-input" id="sp-input" placeholder="输入关键词，如：秋水仙素 / 质壁分离 / 密码子">
  <div class="sp-list" id="sp-list"></div>
</div>
<div class="modal" id="m-dice">
  <h3>随机抽背<button class="m-close">✕</button></h3>
  <div class="qz-stem"><div class="fc-term" id="dice-term"></div><div id="dice-ctx" style="margin-top:10px;font-size:13.5px"></div></div>
  <button class="qz-next show" id="dice-again">换一个</button>
</div>
<button class="xback" id="xback">← <span></span></button>'''

def shell(title, body_attr, inner, datascript):
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>{CSS}</style>
</head>
<body data-book="{body_attr}">
{inner}
<script>{datascript}</script>
<script>
{JS}
</script>
</body>
</html>'''

def book_shell(book, content, alt):
    secN = sum(len(c["secs"]) or 1 for c in book["chapters"])
    hero = f'''<header class="hero">
    <span class="h-badge">{H.escape(book["badge"])}</span>
    <h1>{H.escape(book["label"])} · 必背知识点</h1>
    <p class="h-sub">{H.escape(book["sub"])}</p>
    <p class="h-owner">zzh专属生物复习资料</p>
    <div class="h-meta"><span>{len(book["chapters"])} 章 · {secN} 节</span><span>判断题 {len(book["quiz"])} 条</span><span>闪卡 {len(book["cards"])} 张</span><span>知识点互链 {len(XREFS)} 组</span></div>
  </header>'''
    sidetop = '''<div class="side-head"><a class="side-brand" href="index.html">生物必背知识点<small>INTERACTIVE · 交互复习版</small></a><button class="side-collapse" id="side-collapse" title="收起侧边栏">«</button></div>
      <div class="side-user"><button class="user-chip" id="user-chip"><span class="u-dot" id="u-dot"></span><span class="u-name" id="u-name"></span><span class="u-arr">▾</span></button></div>
      <div class="side-search"><input id="search-in" placeholder="搜索知识点…（Ctrl K）" readonly></div>
      <nav class="toc" id="toc"></nav>'''
    topbar = '''<div class="topbar"><div class="topbar-in">
        <button class="hamb" id="btn-menu">目录</button>
        <div class="crumb" id="crumb"></div>
        <div class="tools">
          <div class="cloze-group"><span class="cg-label">挖空</span><button class="tbtn" data-mode="off">关</button><button class="tbtn" data-mode="half">半数</button><button class="tbtn" data-mode="all">全部</button></div>
          <button class="tbtn" id="btn-quiz">判断快测</button>
          <button class="tbtn" id="btn-cards">闪卡</button>
          <button class="tbtn" id="btn-dice">抽背</button>
          <button class="tbtn" id="btn-theme">夜间</button>
          <button class="tbtn" id="btn-top">顶部</button>
        </div>
      </div><div class="readbar" id="readbar"><i></i></div></div>'''
    inner = f'''<div class="app">
  <aside class="sidebar">{sidetop}</aside>
  <button class="side-expand" id="side-expand" title="展开侧边栏">»</button>
  <div class="main">{topbar}
    <div class="content">
{hero}
{content}
    </div>
    <div class="foot-note">人教版（2019年版）高中生物学 · 数据保存在本机浏览器 · 生成于 {TODAY}</div>
  </div>
</div>
{MODELS}'''
    data = f"const BOOK={jdump(book)}, DATA=BOOK; BOOK.altLabel={jdump(alt)}; const XREFS={jdump(XREFS)};" \
           f"const DOG_END={jdump(b64img('dog_end.jpg'))}, DOG_RUN={jdump(b64img('dog_run.jpg'))};"
    return shell(f"{book['label']} · 必背知识点（交互版）", book["id"], inner, data)

def home_shell(books):
    metas, quiz, cards, search = [], [], [], []
    for b in books.values():
        metas.append({"id": b["id"], "label": b["label"], "file": b["id"] + ".html", "sub": b["sub"],
                      "secs": sum(len(c["secs"]) or 1 for c in b["chapters"]), "chN": len(b["chapters"]),
                      "quizN": len(b["quiz"]), "cardN": len(b["cards"])})
        quiz.extend(b["quiz"]); cards.extend(b["cards"]); search.extend(b["search"])
    home = {"books": metas, "quiz": quiz, "cards": cards, "search": search}
    inner = f'''<div class="home-wrap">
  <header class="hero">
    <span class="h-badge">GAOKAO BIOLOGY · 人教版</span>
    <h1>高中生物必背知识点 · 交互复习</h1>
    <p class="h-sub">目录导航 · 挖空自测 · 知识点互链 · 判断快测 · 闪卡</p>
    <p class="h-owner">zzh专属生物复习资料</p>
    <div class="h-meta" style="margin-top:14px"><button class="user-chip" id="user-chip" style="width:auto"><span class="u-dot" id="u-dot"></span><span class="u-name" id="u-name"></span><span class="u-arr">▾ 切换用户</span></button></div>
  </header>
  <div class="sel-row" style="margin-bottom:18px">
    <button class="tbtn" id="btn-dice2">随机抽背一张</button>
    <button class="tbtn" id="btn-theme2">夜间模式</button>
  </div>
  <div class="home-grid" id="home-books"></div>
  <h3 style="margin-top:28px">学习统计 · <span id="hs-user" style="color:var(--pri)"></span></h3>
  <div class="stat-grid" id="home-stats"></div>
  <p class="foot-note">学习进度按用户保存在本机浏览器中 · 生成于 {TODAY}</p>
</div>
{MODELS}'''
    return shell("高中生物必背知识点 · 交互复习", "home", inner, f"const HOME={jdump(home)}; const DOG_END='', DOG_RUN={jdump(b64img('dog_run.jpg'))};")

def main():
    global TODAY
    TODAY = "2026-11-19"
    books = {
        "m1": parse_book("notes.html", "m1", "必修1《分子与细胞》", "GAOKAO BIOLOGY · 必修一", "课本边角小字 · 易错点 · 易考点 全收录"),
        "m2": parse_book("notes2.html", "m2", "必修2《遗传与进化》", "GAOKAO BIOLOGY · 必修二", "课本边角小字 · 易错点 · 易考点 全收录"),
    }
    books["m2"]["quiz"].extend(M2QUIZ)
    bad = validate_xrefs(books)
    for x in bad:
        print("XREF 目标无效:", x)
    for bid, b in books.items():
        (WEB / f"{bid}.html").write_text(book_shell(b, content_html("notes.html" if bid == "m1" else "notes2.html"),
                                                    "必修2《遗传与进化》" if bid == "m1" else "必修1《分子与细胞》"), encoding="utf-8")
        print(f"{bid}.html: {len(b['chapters'])} 章, 判断题 {len(b['quiz'])} 条, 闪卡 {len(b['cards'])} 张, 搜索索引 {len(b['search'])} 条")
    (WEB / "index.html").write_text(home_shell(books), encoding="utf-8")
    print("index.html 完成")

if __name__ == "__main__":
    main()

