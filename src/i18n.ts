export type Language = 'zh' | 'en' | 'ms';
const valid = (value: string | null): value is Language => value === 'zh' || value === 'en' || value === 'ms';
export function readLanguage(): Language {
  const query = new URLSearchParams(location.search).get('lang');
  if (valid(query)) return query;
  try { const saved = localStorage.getItem('bean-rush-language'); return valid(saved) ? saved : 'zh'; }
  catch { return 'zh'; }
}
export const language = readLanguage();
export function changeLanguage(value: string) {
  if (!valid(value)) return;
  try { localStorage.setItem('bean-rush-language', value); } catch { /* URL works without storage. */ }
  const url = new URL(location.href); url.searchParams.set('lang', value); location.assign(url);
}

// Chinese remains the source text for the existing speech system; only display text is localized.
export const messages: Record<string, [string, string]> = {
  '语言': ['Language', 'Bahasa'],
  '乘云降落': ['Landing on a cloud', 'Mendarat dengan awan'],
  '登云前往解谜花园': ['Cloud ride to Puzzle Garden', 'Naik awan ke Taman Teka-teki'],
  '云端冒险': ['Cloud Adventure', 'Pengembaraan Awan'],
  '云端冒险 · Bean Rush': ['Bean Rush · Cloud Adventure', 'Bean Rush · Pengembaraan Awan'],
  '游戏首页': ['Game home', 'Laman utama permainan'],
  '开始游戏': ['Play', 'Mula Main'],
  '选择关卡': ['Choose a Level', 'Pilih Tahap'],
  '设置': ['Settings', 'Tetapan'],
  '关闭': ['Close', 'Tutup'],
  '第一关': ['Level 1', 'Tahap 1'],
  '第二关': ['Level 2', 'Tahap 2'],
  '天空赛道': ['Sky Race', 'Lumba Awan'],
  '解谜花园': ['Puzzle Garden', 'Taman Teka-teki'],
  '跑一跑，跳向终点': ['Run and jump to the finish', 'Lari dan lompat ke garisan penamat'],
  '找齐钥匙，打开花园': ['Find the keys to open the garden', 'Cari kunci untuk membuka taman'],
  '背景音乐': ['Music', 'Muzik'],
  '音效与语音': ['Sounds & voice', 'Bunyi & suara'],
  '完成': ['Done', 'Selesai'],
  '4岁辅助转向': ['Age 4 steering help', 'Bantuan stereng umur 4'],
  '靠近边缘时帮助回正，跳跃仍由你控制。': ['Helps steer away from edges. You still choose when to jump.', 'Membantu menjauhi tepi. Kamu masih memilih masa untuk melompat.'],
  '云端空岛与紫耳小精灵': ['Sky islands and a purple-eared friend', 'Pulau awan dan kawan bertelinga ungu'],
  '返回首页': ['Home', 'Laman utama'],
  '返回主页': ['Back Home', 'Kembali ke Utama'],
  '全屏游戏': ['Play fullscreen', 'Main skrin penuh'],
  '全屏': ['Fullscreen', 'Skrin penuh'],
  '退出全屏': ['Exit fullscreen', 'Keluar skrin penuh'],
  '关闭声音': ['Mute', 'Senyapkan'],
  '打开声音': ['Unmute', 'Hidupkan bunyi'],
  '暂停游戏': ['Pause game', 'Jeda permainan'],
  '暂停': ['Pause', 'Jeda'],
  '继续游戏': ['Resume game', 'Sambung permainan'],
  '已晋级': ['Qualified', 'Layak'],
  '你的名次': ['Your place', 'Kedudukan kamu'],
  '第': ['#', '#'],
  '名': ['', ''],
  '移动摇杆': ['Move joystick', 'Kayu bedik gerakan'],
  '冲扑': ['Dive', 'Terjah'],
  '跳跃': ['Jump', 'Lompat'],
  '移动': ['Move', 'Gerak'],
  '空格': ['Space', 'Space'],
  '/ 方向键 移动': ['/ Arrow keys: Move', '/ Kekunci anak panah: Gerak'],
  '互动': ['Interact', 'Interaksi'],
  '提示': ['Hint', 'Petunjuk'],
  '前 8 名到达终点': ['Finish in the top 8', 'Tamat dalam 8 teratas'],
  '即可晋级': ['to qualify!', 'untuk layak!'],
  '跳过障碍、躲开摆锤，': ['Jump and dodge the swinging hammers.', 'Lompat dan elak tukul berayun.'],
  '和 11 个小伙伴一起冲！': ['Race with 11 friends!', 'Berlumba dengan 11 kawan!'],
  '跑一跑': ['Run', 'Lari'],
  '跳一跳': ['Jump', 'Lompat'],
  '前 8 名晋级': ['Top 8 qualify', '8 teratas layak'],
  '开始玩': ['Play', 'Mula Main'],
  '继续玩': ['Keep Playing', 'Sambung Main'],
  '重新开始': ['Restart', 'Mula Semula'],
  '再玩一次': ['Play Again', 'Main Lagi'],
  '下一关 · 解谜花园 →': ['Next · Puzzle Garden →', 'Seterusnya · Taman Teka-teki →'],
  '把钥匙': ['keys', 'kunci'],
  '拿起 / 放下': ['Pick up / Put down', 'Ambil / Letak'],
  '小鸡被挡住了': ['The chick is blocked', 'Anak ayam terhalang'],
  '小鸡落后了': ['The chick is behind', 'Anak ayam tertinggal'],
  '找齐钥匙': ['Find the Keys', 'Cari Semua Kunci'],
  '休息一下': ['Take a Break', 'Rehat Sebentar'],
  '大门打开啦！': ['The gate is open!', 'Pintu sudah terbuka!'],
  '晋级啦！': ['You qualified!', 'Kamu layak!'],
  '再来挑战吧！': ['Try Again!', 'Cuba Lagi!'],
  '准备好了就继续冲！': ['Ready? Keep going!', 'Sudah sedia? Teruskan!'],
  '没关系，每次都会更厉害一点！': ['Every try helps you get better!', 'Setiap cubaan menjadikan kamu lebih mahir!'],
  '解开三个谜题，打开花园。': ['Solve three puzzles to open the garden.', 'Selesaikan tiga teka-teki untuk membuka taman.'],
  '准备好，就继续找钥匙。': ['Ready? Let’s find more keys.', 'Sudah sedia? Mari cari kunci lagi.'],
  '太棒了，三把钥匙找齐了！': ['Great! You found all three keys!', 'Bagus! Kamu jumpa ketiga-tiga kunci!'],
  '积木工坊': ['Block Workshop', 'Bengkel Blok'],
  '流水池塘': ['Water Pond', 'Kolam Air'],
  '动物朋友': ['Animal Friends', 'Kawan Haiwan'],
  '玩家': ['You', 'Kamu'],
  '工坊向导': ['Workshop Guide', 'Pemandu Bengkel'],
  '观察一下': ['Look Closely', 'Lihat Betul-betul'],
  '我想找钥匙，你有看到吗？': ['Have you seen a key?', 'Ada nampak kunci?'],
  '你看，铁门后面是不是有东西在发光？': ['Look! Is something shining behind the gate?', 'Lihat! Ada sesuatu bersinar di belakang pintu?'],
  '看到了！可是门关着……': ['Yes! But the gate is closed…', 'Ya! Tetapi pintu tertutup…'],
  '看到了！': ['I see it!', 'Saya nampak!'],
  '可是门关着……': ['But the gate is closed…', 'Tetapi pintu tertutup…'],
  '看看门前的机关，它的形状和哪块积木一样呢？': ['Which block matches the shape in front of the gate?', 'Blok manakah sama bentuk dengan suis di depan pintu?'],
  '看看机关，再看看附近的积木。': ['Look at the switch, then look at the blocks.', 'Lihat suis, kemudian lihat blok berdekatan.'],
  '我去试试看！': ['Let me try!', 'Saya mahu cuba!'],
  '退出对话': ['Close conversation', 'Tutup perbualan'],
  '继续': ['Next', 'Seterusnya'],
  '出发吧': ['Let’s Go', 'Jom'],
  '你找到工坊的钥匙啦！去其他地方看看吧。': ['You found this key! Let’s explore somewhere else.', 'Kamu jumpa kunci bengkel! Mari teroka tempat lain.'],
  '铁门打开了！快去拿里面的钥匙吧。': ['The gate is open! Go get the key.', 'Pintu sudah terbuka! Pergi ambil kunci.'],
  '正方体': ['Cube', 'Kubus'],
  '圆柱积木': ['Cylinder', 'Silinder'],
  '三角积木': ['Triangular block', 'Blok segi tiga'],
  '长方体': ['Cuboid', 'Kuboid'],
  '找找一样的形状': ['Find the matching shape', 'Cari bentuk yang sama'],
  '积木工坊 · 铁门关着，地上的图案有点特别。': ['Block Workshop · The gate is closed. Look at the mark on the ground.', 'Bengkel Blok · Pintu tertutup. Lihat corak di atas tanah.'],
  '流水池塘 · 水在这里停住了，小花好像有些口渴。': ['Water Pond · The water has stopped. The flowers look thirsty.', 'Kolam Air · Air terhenti di sini. Bunga nampak dahaga.'],
  '动物朋友 · 小鸡盯着谷粒，鸡舍里似乎藏着什么。': ['Animal Friends · The chick wants grain. What is inside its coop?', 'Kawan Haiwan · Anak ayam mahu bijirin. Apa di dalam reban?'],
  '花园里藏着3把钥匙，会在哪里呢？': ['Three keys are hiding in the garden. Where could they be?', 'Tiga kunci tersembunyi di taman. Di manakah kunci itu?'],
  '第二关：解谜花园': ['Level 2: Puzzle Garden', 'Tahap 2: Taman Teka-teki'],
  '放下': ['Put down', 'Letak'],
  '拿起': ['Pick up', 'Ambil'],
  '对话': ['Talk', 'Bercakap'],
  '看水管': ['Look at pipes', 'Lihat paip'],
  '转水管': ['Turn pipe', 'Putar paip'],
  '拿谷粒': ['Take grain', 'Ambil bijirin'],
  '放谷粒': ['Put grain down', 'Letak bijirin'],
  '看鸡舍': ['Look at coop', 'Lihat reban'],
  '招呼小鸡': ['Call chick', 'Panggil anak ayam'],
  '看大门': ['Look at gate', 'Lihat pintu'],
  '看一看': ['Look', 'Lihat'],
  '3把钥匙齐了 · 远处传来了开门的声音。': ['All 3 keys! A gate opened in the distance.', 'Cukup 3 kunci! Sebuah pintu terbuka di sana.'],
  '手里的积木沉甸甸的，会有什么用呢？': ['This block is heavy. What could it do?', 'Blok ini berat. Apa gunanya?'],
  '工坊向导在这里 · 按 E 或点击「对话」问问线索。': ['The guide is here. Press E or tap Talk for a clue.', 'Pemandu ada di sini. Tekan E atau Bercakap untuk petunjuk.'],
  '小鸡在后面等你，谷粒离它太远了。': ['The chick is waiting. Bring the grain closer.', 'Anak ayam menunggu. Bawa bijirin lebih dekat.'],
  '小鸡被挡住了，它需要一条能走过去的小路。': ['The chick is blocked. Find a clear path for it.', 'Anak ayam terhalang. Cari laluan untuknya.'],
  '小鸡在鸡舍门口张望，怎样让它愿意进去呢？': ['The chick is at the door. How can you invite it inside?', 'Anak ayam di pintu reban. Bagaimana mengajaknya masuk?'],
  '小鸡跟着谷粒走了': ['The chick is following the grain!', 'Anak ayam mengikut bijirin!'],
  '工坊铁门开了 · 里面闪着一点金光。': ['The workshop gate is open. Something golden is shining inside.', 'Pintu bengkel terbuka. Ada cahaya keemasan di dalam.'],
  '跳上花朵拿钥匙': ['Jump onto the flower to get the key', 'Lompat ke atas bunga untuk mengambil kunci'],
  '小鸡带回了粉色钥匙，快看看它的发现！': ['The chick brought a pink key. Come and see!', 'Anak ayam membawa kunci merah jambu. Mari lihat!'],
  '小鸡在鸡舍里翻找，等它带回发现吧。': ['The chick is searching. Wait for its surprise.', 'Anak ayam sedang mencari. Tunggu kejutannya.'],
  '水流过去了，小花好像有了变化。': ['The water is flowing. Look at the flowers!', 'Air sudah mengalir. Lihat bunga!'],
  '水往前流了一点，又在哪里停住了呢？': ['The water went a little further. Where did it stop?', 'Air mengalir sedikit lagi. Di manakah ia terhenti?'],
  '三把钥匙齐了，看看远处的大门。': ['You have three keys. Look at the big gate.', 'Kamu ada tiga kunci. Lihat pintu besar.'],
  '沿着中间的小路走向打开的大门。': ['Follow the middle path to the open gate.', 'Ikut laluan tengah ke pintu yang terbuka.'],
  '示范：走过打开的大门，就完成冒险啦！': ['Try walking through the open gate to finish!', 'Cuba berjalan melalui pintu terbuka untuk tamat!'],
  '小花开了，跳上去看看吧！': ['The flowers opened. Jump up and look!', 'Bunga sudah mekar. Lompat dan lihat!'],
  '谜题有变化了，看看哪里在发光。': ['Something changed. Look for a glow.', 'Sesuatu berubah. Cari cahaya.'],
  '钥匙就在打开的铁门后面。': ['The key is behind the open gate.', 'Kunci di belakang pintu yang terbuka.'],
  '蓝色钥匙在花朵上方。': ['The blue key is above the flowers.', 'Kunci biru di atas bunga.'],
  '粉色钥匙在鸡舍门口。': ['The pink key is at the coop door.', 'Kunci merah jambu di pintu reban.'],
  '示范：先跳上较低的花瓣，再跳到高处碰到钥匙。': ['Jump onto the low petal, then higher to reach the key.', 'Lompat ke kelopak rendah, kemudian lebih tinggi untuk mencapai kunci.'],
  '示范：走近发光的钥匙，就能拿到它。': ['Walk up to the glowing key to pick it up.', 'Dekati kunci yang bersinar untuk mengambilnya.'],
  '机关上有一个正方形。工坊里有一样形状的积木吗？': ['The switch has a square. Can you find a matching block?', 'Suis ada bentuk segi empat sama. Boleh cari blok yang sepadan?'],
  '手里的积木形状不同，找找正方体。': ['This block is a different shape. Look for a cube.', 'Bentuk blok ini berbeza. Cari kubus.'],
  '把手里的正方体带到方形机关旁。': ['Carry the cube to the square switch.', 'Bawa kubus ke suis segi empat sama.'],
  '看看正方体积木，它和机关的形状一样。': ['Look at the cube. It matches the switch.', 'Lihat kubus. Bentuknya sepadan dengan suis.'],
  '示范：先按互动放下这块积木，再去拿正方体。': ['Tap Interact to put this block down, then pick up the cube.', 'Tekan Interaksi untuk meletakkan blok ini, kemudian ambil kubus.'],
  '示范：靠近方形机关，按互动放下正方体。': ['Go to the square switch and tap Interact to put the cube down.', 'Dekati suis segi empat sama dan tekan Interaksi untuk meletakkan kubus.'],
  '示范：走近正方体，按互动把它拿起来。': ['Go to the cube and tap Interact to pick it up.', 'Dekati kubus dan tekan Interaksi untuk mengambilnya.'],
  '沿着水流看一看，水停在哪一段水管前？': ['Follow the water. Which pipe is stopping it?', 'Ikut aliran air. Paip manakah yang menghalangnya?'],
  '示范：靠近这段水管，按一次互动转一下，再看看水流。': ['Go to this pipe. Tap Interact to turn it, then watch the water.', 'Dekati paip ini. Tekan Interaksi untuk memutarnya, kemudian lihat air.'],
  '小鸡喜欢谷粒，也能钻进你进不去的小门。': ['The chick likes grain and can fit through the little door.', 'Anak ayam suka bijirin dan boleh melalui pintu kecil.'],
  '小鸡在鸡舍里找东西，看看门口。': ['The chick is searching inside. Watch the door.', 'Anak ayam mencari di dalam. Lihat pintu.'],
  '带着谷粒慢慢走向鸡舍的小门，等等小鸡。': ['Carry the grain slowly to the little door. Wait for the chick.', 'Bawa bijirin perlahan-lahan ke pintu kecil. Tunggu anak ayam.'],
  '看看小鸡旁边的那碗谷粒。': ['Look at the bowl of grain beside the chick.', 'Lihat mangkuk bijirin di sebelah anak ayam.'],
  '示范：在门口等一等，小鸡会带回钥匙。': ['Wait at the door. The chick will bring a key.', 'Tunggu di pintu. Anak ayam akan membawa kunci.'],
  '示范：带小鸡走到小门旁，等它跟上，再按互动放谷粒。': ['Lead the chick to the door. Wait, then tap Interact to put down grain.', 'Bawa anak ayam ke pintu. Tunggu, kemudian tekan Interaksi untuk meletakkan bijirin.'],
  '示范：走近谷粒，按互动拿起来，小鸡就会跟着你。': ['Go to the grain and tap Interact. The chick will follow you.', 'Dekati bijirin dan tekan Interaksi. Anak ayam akan mengikut kamu.'],
  '正方体压住机关，铁门开啦！': ['The cube pressed the switch. The gate is open!', 'Kubus menekan suis. Pintu sudah terbuka!'],
  '拿起来啦！这个形状能帮上什么忙呢？': ['You picked it up! What could this shape help with?', 'Sudah diambil! Apakah kegunaan bentuk ini?'],
  '水已经接通啦！小花替你找到一把钥匙。': ['The water is connected! The flowers found a key for you.', 'Air sudah bersambung! Bunga menemukan kunci untuk kamu.'],
  '小鸡还没跟上来，等等它吧。': ['The chick is still coming. Wait for it.', 'Anak ayam belum sampai. Tunggu sebentar.'],
  '小鸡钻进去了！': ['The chick went inside!', 'Anak ayam sudah masuk!'],
  '鸡舍里传来小鸡的声音。': ['You can hear the chick inside.', 'Kamu boleh dengar anak ayam di dalam.'],
  '小鸡一直盯着那碗谷粒呢。': ['The chick keeps looking at the grain.', 'Anak ayam asyik melihat bijirin.'],
  '小鸡在原地打转，好像走不过去。': ['The chick cannot get through here.', 'Anak ayam tidak dapat melalui sini.'],
  '小鸡正看着你手里的谷粒。': ['The chick is watching your grain.', 'Anak ayam melihat bijirin di tangan kamu.'],
  '出口就在前面，走过去吧！': ['The exit is ahead. Walk through!', 'Jalan keluar di depan. Teruskan!'],
  '谢谢小鸡！快来拿粉色钥匙吧！': ['Thank you, chick! Come get the pink key!', 'Terima kasih, anak ayam! Mari ambil kunci merah jambu!'],
  '三把钥匙都找到啦！走去出口吧！': ['All three keys found! Go to the exit!', 'Ketiga-tiga kunci dijumpai! Pergi ke jalan keluar!'],
  '大门打开啦！你是小小解谜高手！': ['The gate is open! You are a puzzle star!', 'Pintu terbuka! Kamu hebat menyelesaikan teka-teki!'],
  '小花开啦！跳到花上拿蓝色钥匙！': ['The flowers opened! Jump up to get the blue key!', 'Bunga mekar! Lompat untuk mengambil kunci biru!'],
  '跟着箭头走！': ['Follow the arrows!', 'Ikut anak panah!'],
  '从柱子中间穿过去！': ['Go between the pillars!', 'Lalu di antara tiang!'],
  '按跳跃！': ['Tap Jump!', 'Tekan Lompat!'],
  '跳过小缺口！': ['Jump over the gap!', 'Lompat melepasi jurang!'],
  '快到终点啦！': ['Almost at the finish!', 'Hampir ke garisan penamat!'],
  '准备——出发！': ['Ready, set, go!', 'Sedia, mula!'],
  '没关系，继续向前！': ['It’s OK. Keep going!', 'Tidak mengapa. Teruskan!'],
  '没关系，再试一次！': ['It’s OK. Try again!', 'Tidak mengapa. Cuba lagi!'],
  '加载中': ['Loading', 'Memuatkan'],
  '空岛': ['Sky Island', 'Pulau Awan'],
  '小精灵乘云穿过云海': ['A little friend riding through the clouds', 'Kawan kecil menaiki awan'],
  '乘着云，出发吧': ['Let’s ride the clouds!', 'Jom naik awan!'],
  '跳过动画': ['Skip', 'Langkau'],
  '暂时无法打开游戏，请刷新再试一次。': ['The game could not open. Please refresh and try again.', 'Permainan tidak dapat dibuka. Muat semula dan cuba lagi.'],
  '软糖冲刺三维赛道': ['Bean Rush 3D race course', 'Litar lumba 3D Bean Rush'],
};

const patterns: [RegExp, (match: RegExpMatchArray) => [string, string]][] = [
  [/^你是第 (\d+) 名到达终点！$/, m => [`You finished in place ${m[1]}!`, `Kamu tamat di tempat ${m[1]}!`]],
  [/^已找到(\d)\/3把钥匙 · 花园里还有新的发现。$/, m => [`${m[1]}/3 keys found. Keep exploring!`, `${m[1]}/3 kunci dijumpai. Teruskan meneroka!`]],
  [/^看看水停住后面的第(\d)段水管，它的管口朝向哪里？$/, m => [`Look at pipe ${m[1]}. Which way does its opening face?`, `Lihat paip ${m[1]}. Ke arah mana bukaannya?`]],
  [/^(.+)和方形机关对不上，再找找正方体！$/, m => [`${t(m[1])} does not fit. Look for a cube!`, `${t(m[1])} tidak sepadan. Cari kubus!`]],
  [/^拿起(.+)啦！看看机关要什么形状。$/, m => [`You picked up ${t(m[1])}. What shape does the switch need?`, `Kamu mengambil ${t(m[1])}. Suis memerlukan bentuk apa?`]],
  [/^大门还差(\d)把钥匙，再去探索吧。$/, m => [`Find ${m[1]} more keys to open the gate.`, `Cari ${m[1]} lagi kunci untuk membuka pintu.`]],
  [/^拿到第(\d)把钥匙啦！真棒！$/, m => [`You found key ${m[1]}! Great!`, `Kamu jumpa kunci ${m[1]}! Bagus!`]],
  [/^✓ 已接通 (\d) \/ 3 段水管$/, m => [`✓ ${m[1]} / 3 pipes connected`, `✓ ${m[1]} / 3 paip bersambung`]],
  [/^乘云前往(.+)$/, m => [`Cloud ride to ${t(m[1])}`, `Naik awan ke ${t(m[1])}`]],
  [/^正在准备(.+)…$/, m => [`Getting ${t(m[1])} ready…`, `Menyediakan ${t(m[1])}…`]],
  [/^(.+)，我们来啦$/, m => [`Here comes ${t(m[1])}!`, `Kita tiba di ${t(m[1])}!`]],
  [/^下一站 · (.+)$/, m => [`Next stop · ${t(m[1])}`, `Destinasi seterusnya · ${t(m[1])}`]],
];
export function t(text: string): string {
  if (language === 'zh') return text;
  const key = text.trim(), index = language === 'en' ? 0 : 1;
  let translated = messages[key]?.[index];
  if (translated === undefined) for (const [pattern, render] of patterns) {
    const match = key.match(pattern);
    if (match) { translated = render(match)[index]; break; }
  }
  return translated === undefined ? text : text.replace(key, () => translated!);
}

// Called when a menu is built/changed, never as a per-frame DOM observer.
export function localize(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement?.closest('script,style')) node.textContent = t(node.textContent ?? '');
  }
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attr of ['aria-label', 'title', 'alt']) {
      const value = element.getAttribute(attr);
      if (value) element.setAttribute(attr, t(value));
    }
    if (element instanceof HTMLAnchorElement && element.origin === location.origin) {
      const url = new URL(element.href); url.searchParams.set('lang', language); element.href = url.href;
    }
  }
}
