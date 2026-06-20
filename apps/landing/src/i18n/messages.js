/** @type {Record<string, Record<string, unknown>>} */
export const messages = {
  en: {
    meta: {
      title: 'Planetz × Manta — Command your agent squad from your desk',
      description:
        'Planetz × Manta — Run autonomous AI agents on the edge, give orders by voice, and approve with your thumb. Command software Planetz and the Manta desktop robot.',
    },
    nav: {
      label: 'Primary',
      pricing: 'Pricing',
      faq: 'FAQ',
      download: 'Download',
      docs: 'Docs',
      seePricing: 'See pricing',
      menu: 'Menu',
    },
    hero: {
      eyebrow: 'Edge AI × Desktop robot',
      titleHtml:
        'True AI-driven development,<br />in <span class="gradient-text">your hands</span>',
      leadHtml:
        'Runaway agents. Approval fatigue. Planetz <strong>solves both</strong> with a desktop robot built for AI development and a desktop app with a full agent harness—so your <strong>workflow changes for good</strong>.',
      reserveHtml: 'Reserve Manta (<span class="price-promo"><s>$70</s> $35</span>)',
      seeManta: 'See Manta',
      watchTeaser: 'Watch the demo',
      specsLink: 'Full specifications →',
      mantaAlt: 'Manta — desktop AI robot with a status LCD',
    },
    download: {
      eyebrow: 'Free · Open source',
      title: 'Download desktop app for free',
      freeChip: 'Free · OSS',
      point1: 'Signed macOS DMG',
      point2: 'MIT-licensed open source',
      point3: 'Runs fully on your machine',
      cta: 'Download for macOS',
      note: 'Signed macOS DMG on GitHub Releases — free OSS desktop build.',
    },
    demo: {
      eyebrow: 'Product demo',
      title: 'The Planetz Agent Deck demo',
      lead: 'Not a mockup—a recording of the actual desktop app in action.',
      badge: 'Live app',
      youtubeCta: 'Open on YouTube →',
    },
    manta: {
      eyebrow: 'The Body — Manta',
      title: 'A desktop robot built for AI-driven development',
      lead: 'Manta is a new input device designed around AI-driven development. Approval, voice input, and agent status live on your desk in one place.',
      lcdTitle: 'Status LCD',
      lcdBody:
        '<code>PROCESSING...</code>, <code>APPROVE?</code>, <code>BLOCKED</code>—see what is happening without switching monitors.',
      approveTitle: 'Approve / Deny',
      approveBody:
        'Green to proceed, red to stop. Physical human-in-the-loop for risky actions like deploy or delete.',
      voiceTitle: 'Voice order',
      voiceBody:
        'Hold Talk and speak. Speech is transcribed on your machine and sent to Planetz as the agent’s next instruction—no long typing.',
    },
    deck: {
      eyebrow: 'The Control Deck — Planetz',
      title: 'An AI harness for more autonomous agents',
      lead: 'Planetz is a desktop app that manages multiple autonomous AI agents with task lanes and workflows. Built-in harness feedback reduces the cost of watching every run.',
      previewLabel: 'Planetz Agent Deck screen mockup',
      c2Title: 'Command & Control',
      c2Body:
        'See parallel agents by task, log, approval queue, and recovery. You move from typing everything to directing the squad.',
      harnessTitle: 'Harness control',
      harnessBody:
        'Define where humans must approve in the workflow. Pair with Manta buttons to keep autonomous agents bounded.',
      dataTitle: 'Data sovereignty',
      dataBody:
        'Keep workspace, settings, and run data on your machine. Designed for teams that do not park API keys in SaaS.',
      deviceTitle: 'Device Protocol',
      deviceBody:
        'Manta connects over USB-C / BLE as an I/O appliance. Approve, reject, PTT, and state push on an open protocol roadmap.',
    },
    edge: {
      eyebrow: 'Edge AI',
      title: 'An app built on edge AI',
      lead1:
        'Planetz Desktop connects to Ollama and local STT on your PC so agents can run without sending confidential code or documents to the cloud.',
      lead2: 'Combine with Cloud when teams need a managed option at different security levels.',
      idleTitle: 'Local idle',
      idleBody: 'Models, workspace, and approval policy stay on your machine.',
      listenTitle: 'Voice orders',
      listenBody: 'Inject instructions from the Talk button. STT stays local by design.',
      approveTitle: 'Physical approval',
      approveBody: 'Risky steps wait until you approve on Manta.',
    },
    cloud: {
      eyebrow: 'Planetz Cloud',
      titleHtml: 'Cloud when you need it<br />Flexible operations',
      lead: 'Cloud is the managed edition for teams that cannot host locally. The same deck experience in the browser, with a monthly discount for Manta owners.',
      point1:
        '<strong>Managed private node</strong> — isolated execution and always-on workflow watch',
      point2:
        '<strong>Browser control</strong> — enqueue, monitor, and recover without Manta on the desk',
      point3:
        '<strong>Data boundary</strong> — clear separation of keys and runtime for audit-friendly teams',
      point4: '<strong>Manta owner discount</strong> — Cloud at $30/mo for hardware buyers',
    },
    flow: {
      eyebrow: 'How it works',
      title: 'Three layers: Cloud, Desktop app, and physical input',
      lead: 'Planetz on screen, local LLM on your PC, and Manta for approve-and-talk—one continuous loop for running dev agents.',
      s1Title: 'Run agents from Planetz',
      s1Body:
        'Open a workspace, assign agents, and decide where human approval is required. Enqueue, monitor, and retry from the app.',
      s2Title: 'Inference on your PC',
      s2Body:
        'Connect Ollama or other local LLMs. Keep confidential code and docs off the public cloud.',
      s3Title: 'Approve and speak on Manta',
      s3Body:
        'Answer “may I proceed?” with green or red buttons. Hold Talk to turn speech into a new task instruction in Planetz.',
      s4Title: 'Scale to Cloud for teams',
      s4Body:
        'Managed private environments for members who cannot run locally—shared workspaces and unified rules.',
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Plans for agent commanders',
      mantaTier: 'Manta (Hardware)',
      mantaUnit: '/ device',
      mantaDesc:
        'Galaxy-finish desktop robot. LCD, ambient light, physical approval, voice orders.',
      mantaLi1: 'Approve / Deny buttons',
      mantaLi2: 'Talk (PTT) button',
      mantaLi3: 'Status LCD',
      mantaLi4: 'USB-C / BLE',
      mantaCta: 'Join waitlist',
      desktopBadge: 'Edge',
      desktopTier: 'Desktop',
      desktopUnit: '/ mo',
      desktopDesc: 'Desktop subscription for local inference and Manta integration.',
      desktopLi1: 'Ollama / edge inference',
      desktopLi2: 'Manta / HID devices',
      desktopLi3: 'Voice orders (local STT)',
      desktopLi4: 'Advanced workflow GUI',
      desktopCta: 'Download for macOS',
      cloudTier: 'Cloud',
      cloudUnit: '/ mo',
      cloudDesc: 'Managed private node. Browser Planetz for teams.',
      cloudLi1: 'Orbit / watch on cloud VM',
      cloudLi2: 'Control runs from the browser',
      cloudLi3: '<strong>$30/mo for Manta owners</strong>',
      cloudLi4: 'Team sharing & audit logs',
      cloudCta: 'Join Cloud waitlist',
    },
    waitlist: {
      title: 'Early access — Manta & Planetz Cloud',
      lead: 'We will send Manta reservation updates and Cloud beta invites in order.',
      emailLabel: 'Email address',
      submit: 'Sign up',
      success: 'You are on the list. Beta invites will arrive in waves.',
      notConfigured: 'Waitlist is not open yet. Please try again later.',
      error: 'Sign-up failed. Please try again in a moment.',
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Questions',
      q1: 'Can I use Planetz without Manta?',
      a1: 'Yes. Planetz Agent Deck runs as a desktop app on its own—you approve and operate from the screen. Manta is optional hardware for safer, more ambient control.',
      q2: 'Why use edge AI (Ollama)?',
      a2: 'Privacy and security: run inference on your machine without sending source code or internal docs to external APIs. You can keep working offline (e.g. airplane mode) where local models allow.',
      q3: 'Is there a discount for hardware owners?',
      a3: 'Yes. Manta buyers get Planetz Cloud for $30/mo (regular $40/mo).',
      q4: 'What does the Manta LCD show?',
      a4: 'Short status text such as <code>IDLE</code>, <code>LISTENING</code>, <code>PROCESSING...</code>, <code>APPROVE?</code>, <code>ERROR</code>—plus ambient light for peripheral awareness.',
      q5: 'How do local Deck and Cloud relate?',
      a5: 'They share the same deck UX and workflows. Teams can start locally and move workspaces to Cloud without relearning the product.',
    },
    footer: {
      navLabel: 'Footer',
      docs: 'Docs',
      pricing: 'Pricing',
    },
    lang: {
      label: 'Language',
      en: 'EN',
      ja: 'JA',
    },
  },
  ja: {
    meta: {
      title: 'Planetz × Manta — エージェント部隊を、手のひらで指揮する',
      description:
        'Planetz × Manta — 自律AIエージェント部隊を手元のエッジで安全に動かし、声で指示し、親指で承認する。管制ソフト Planetz とデスクトップロボ Manta。',
    },
    nav: {
      label: 'メインメニュー',
      pricing: '料金',
      faq: 'FAQ',
      download: 'ダウンロード',
      docs: 'ドキュメント',
      seePricing: '価格を見る',
      menu: 'メニュー',
    },
    hero: {
      eyebrow: 'エッジAI × デスクトップロボ',
      titleHtml: '真のAI駆動開発を、<br /><span class="gradient-text">あなたの手</span>で',
      leadHtml:
        '暴走するAIエージェント、数々の承認を繰り返すだけの開発への疲弊。Planetzが<strong>全てを解決</strong>します。AI開発に特化したデスクトップロボと、完全なハーネスを備えたSDKアプリが、これまでの<strong>開発体験を劇的に</strong>変えます。',
      reserveHtml: 'Manta を予約する（<span class="price-promo"><s>$70</s> $35</span>）',
      seeManta: 'Manta を見る',
      watchTeaser: 'デモを見る',
      specsLink: '詳細仕様を見る →',
      mantaAlt: 'Manta — ステータス液晶を備えたデスクトップAIロボ',
    },
    download: {
      eyebrow: '無料・オープンソース',
      title: 'デスクトップアプリを無料でダウンロード',
      freeChip: '無料 · OSS',
      point1: '署名済み macOS DMG',
      point2: 'MIT ライセンスの OSS',
      point3: 'ローカルで完結',
      cta: 'macOS 版をダウンロード',
      note: '署名済み macOS DMG を GitHub Releases で配布 — OSS 版は無料でそのまま利用可能。',
    },
    demo: {
      eyebrow: 'プロダクトデモ',
      title: 'Planetz Agent Deck の紹介動画',
      lead: 'モックアップではなく、実際のデスクトップアプリの動作を収録した紹介動画です。',
      badge: '実機デモ',
      youtubeCta: 'YouTube で開く →',
    },
    manta: {
      eyebrow: 'The Body — Manta',
      title: 'AI開発に特化したデスクトップロボ',
      lead: 'Manta は、AI駆動開発を前提にUXデザインされた新しい開発デバイスです。承認・音声入力・エージェント状態表示を、一つのデバイスで管理・完結させます。',
      lcdTitle: 'ステータスLCD',
      lcdBody:
        '<code>PROCESSING...</code>、<code>APPROVE?</code>、<code>BLOCKED</code>。モニタを切り替えなくても、今なにが起きているかを一目で把握できます。',
      approveTitle: 'Approve / Deny',
      approveBody:
        '進める操作は緑の承認、止める操作は赤の却下。デプロイや削除のような危険操作に、物理的な Human-in-the-loop を置きます。',
      voiceTitle: 'Voice order',
      voiceBody:
        'Talk を押して話せば、手元で文字起こしした内容が Planetz に渡り、エージェントへの指示になります。長文入力から解放されます。',
    },
    deck: {
      eyebrow: 'The Control Deck — Planetz',
      title: 'AIハーネスで、より自律的なエージェントへ',
      lead: 'Planetz は、複数の自律AIエージェントをタスクレーンとワークフローで管理するデスクトップアプリです。組み込まれたハーネスによる適切なフィードバックにより、監視の手間が軽減されます。',
      previewLabel: 'Planetz Agent Deck の画面イメージ',
      c2Title: 'Command & Control',
      c2Body:
        '並列に走るエージェントを、タスク、ログ、承認待ち、失敗復旧の単位で見える化。人間は「打つ人」から「指揮する人」へ移ります。',
      harnessTitle: 'Harness control',
      harnessBody:
        'どの操作で人間の承認を挟むかをワークフローで定義。Manta のボタンと連動し、自律エージェントを制御下に置きます。',
      dataTitle: 'Data sovereignty',
      dataBody:
        'ワークスペース、設定、実行データを手元の境界に保ちます。機密コードやAPIキーをSaaSへ預けない運用を前提に設計します。',
      deviceTitle: 'Device Protocol',
      deviceBody:
        'Manta は USB-C / BLE で接続する入出力アプライアンス。承認、却下、PTT、状態Pushを開いたプロトコルへ拡張していきます。',
    },
    edge: {
      eyebrow: 'Edge AI',
      title: 'Edge AI ベースの開発アプリ',
      lead1:
        'Planetz Desktop はローカルPC側の Ollama やローカルSTTと接続し、機密コードや社内文書をクラウドへ送らずにエージェントを動かすためのエッジ運用を中心に据えます。',
      lead2:
        'クラウド版と組み合わせることで、業務のセキュリティレベルに応じた柔軟な運用が可能です。',
      idleTitle: 'ローカル待機',
      idleBody: 'モデル、ワークスペース、承認ポリシーは手元の環境に閉じる。',
      listenTitle: '声で order',
      listenBody: 'Talk ボタンから intent を注入。STT もローカル処理を前提にする。',
      approveTitle: '物理承認',
      approveBody: '危険操作は Manta の承認が入るまで止まる。',
    },
    cloud: {
      eyebrow: 'Planetz Cloud',
      titleHtml: 'Cloud版も用意<br />柔軟な運用をサポート',
      lead: 'Cloud はローカルに実行環境を置けないチーム向けのマネージド版です。Planetz のデッキ体験をブラウザへ広げ、Manta 所有者には月額割引を提供します。',
      point1:
        '<strong>Managed private node</strong> — チーム専用の隔離実行環境でワークフローを常時監視',
      point2:
        '<strong>Browser control</strong> — Manta が手元になくても、Web UI からタスク投入・監視・復旧',
      point3:
        '<strong>Data boundary</strong> — 鍵と実行環境の境界を明示し、チーム運用の監査性を高める',
      point4:
        '<strong>Manta owner discount</strong> — ハードウェア購入者は Cloud を $30/mo で利用可能',
    },
    flow: {
      eyebrow: 'How it works',
      title: 'Cloud・Desktop (App)・Physical (Input) の 3 層をカバー',
      lead: 'Planetz（画面で管理）・ローカル LLM（手元で推論）・Manta（机で承認と音声入力）を組み合わせ、開発エージェントの運用をシームレスに連携します。',
      s1Title: 'Planetz でエージェントをまとめて動かす',
      s1Body:
        'デスクトップアプリにワークスペースを開き、どのエージェントに何を任せるか、どこで人の承認を挟むかを決めます。投入・監視・やり直しは画面から行います。',
      s2Title: '推論はあなたの PC で',
      s2Body:
        'Ollama などのローカル LLM に接続します。機密のコードや社内文書をクラウドへ送らず、自分のマシン上で AI を動かせます。',
      s3Title: 'Manta で承認と音声の指示',
      s3Body:
        '「進めてよいか」の確認は、緑・赤のボタンでその場に返答。Talk ボタンで話した内容は手元で文字になり、Planetz へ新しい作業指示として渡せます。',
      s4Title: 'チームなら Cloud へ',
      s4Body:
        '手元に環境を置けないメンバー向けに、マネージドのプライベート環境を用意。ワークスペースの共有と、ルールの統一ができます。',
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'エージェント指揮官のためのプラン',
      mantaTier: 'Manta (Hardware)',
      mantaUnit: '/ 本体',
      mantaDesc: '星空筐体のデスクトップロボ。LCD、呼吸光、物理承認、音声 order。',
      mantaLi1: 'Approve / Deny 物理ボタン',
      mantaLi2: 'Talk (PTT) ボタン',
      mantaLi3: '簡易LCDステータス表示',
      mantaLi4: 'USB-C / BLE 接続',
      mantaCta: '予約リストに登録',
      desktopBadge: 'Edge',
      desktopTier: 'Desktop',
      desktopUnit: '/ 月',
      desktopDesc: 'ローカル推論と Manta 連携を使い続けるデスクトップ版サブスクリプション。',
      desktopLi1: 'Ollama / エッジ推論連携',
      desktopLi2: 'Manta / HID デバイス連携',
      desktopLi3: '音声 order (ローカル STT)',
      desktopLi4: '高度なワークフロー GUI',
      desktopCta: 'macOS版をダウンロード',
      cloudTier: 'Cloud',
      cloudUnit: '/ 月',
      cloudDesc: 'マネージド・プライベートノード。チームで使うブラウザ版 Planetz。',
      cloudLi1: 'クラウド VM 上の Orbit / watch',
      cloudLi2: 'ブラウザからの実装コントロール',
      cloudLi3: '<strong>Manta 所有者は $30/月</strong>',
      cloudLi4: 'チーム共有・監査ログ',
      cloudCta: 'Cloud 先行登録',
    },
    waitlist: {
      title: 'Manta / Planetz Cloud の先行登録',
      lead: 'Manta の予約案内と Cloud ベータ招待を順次送付します。',
      emailLabel: 'メールアドレス',
      submit: '登録する',
      success: '登録を受け付けました。ベータ招待は順次お送りします。',
      notConfigured: '先行登録は現在準備中です。しばらくしてから再度お試しください。',
      error: '登録に失敗しました。時間をおいて再度お試しください。',
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'よくある質問',
      q1: 'Manta がなくても Planetz は使えますか？',
      a1: 'はい、可能です。Planetz Agent Deck は単体のデスクトップアプリとして動作し、画面上のクリックで承認や操作を行えます。Manta は、より直感的かつ安全に「ながら操作」を行うための専用ハードウェアです。',
      q2: 'エッジ AI (Ollama) を使うメリットは何ですか？',
      a2: '最大のメリットはプライバシーとセキュリティです。ソースコードや社内ドキュメントを外部の API に送ることなく、手元のマシン内で推論を完結させることができます。また、オフライン環境（飛行機モードなど）でもエージェントを動かし続けることが可能です。',
      q3: 'ハードウェア所有者向けの割引はありますか？',
      a3: 'はい。Manta を購入されたユーザーは、Planetz Cloud プランを月額 $30（通常 $40）の特別価格で利用できます。',
      q4: 'Manta のLCDには何が表示されますか？',
      a4: '<code>IDLE</code>、<code>LISTENING</code>、<code>PROCESSING...</code>、<code>APPROVE?</code>、<code>ERROR</code> など、エージェント部隊の現在状態を短いテキストで表示します。呼吸光と組み合わせて、周辺視野で状態を把握できます。',
      q5: 'ローカル Deck と Cloud の関係は？',
      a5: '同じ操作画面と手順を共有します。ローカルで慣れたチームが、そのまま Cloud 上の workspace に移行できることを目指しています。',
    },
    footer: {
      navLabel: 'フッター',
      docs: 'ドキュメント',
      pricing: '料金',
    },
    lang: {
      label: '言語',
      en: 'EN',
      ja: 'JA',
    },
  },
}
