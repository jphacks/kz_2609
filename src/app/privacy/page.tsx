import { PageHeader } from "@/components/ui";

// S-16 プライバシーポリシー（JPHACKS デモ用の仮の文面。正式リリース前に見直す）
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 text-sm leading-7">
      <PageHeader title="プライバシーポリシー" backHref="/" />
      <h2 className="mt-2 font-bold">取得する情報</h2>
      <ul className="list-disc pl-5">
        <li>登録したメールアドレス（パスワードは暗号化して保存し、運営者も見られません）</li>
        <li>Googleでログインした場合は、Googleアカウントの名前とアイコン画像</li>
        <li>投稿した写真・コメント・カテゴリ・滞在時間・投稿日時</li>
      </ul>
      <h2 className="mt-4 font-bold">位置情報と写真の情報</h2>
      <ul className="list-disc pl-5">
        <li>
          現在地は、近くのスポットを探すときと経路の出発地に使います。現在地そのものは保存しません（新しいスポットを登録した場合は、そのスポットの位置として保存します）。
        </li>
        <li>写真に含まれる位置情報・撮影機器などの情報（EXIF）は、アップロード前にすべて取り除きます。</li>
        <li>地図の検索で選んだ場所の履歴は、お使いの端末（ブラウザ）にだけ保存し、サーバーには送りません。検索画面の「履歴を消去」で消せます。</li>
        <li>
          地図の検索でマイクを使うと、話した音声はお使いのブラウザの音声認識サービス（Chrome では Google、Safari では Apple）で文字にされます。このアプリは音声そのものを受け取らず、保存もしません。
        </li>
      </ul>
      <h2 className="mt-4 font-bold">リストの共有</h2>
      <p>
        行きたい場所リストは、ふだんはあなただけが見られます。共有URLを発行すると、そのURLを知っている人はログインなしでリスト名・スポット・拠点を見られます（編集はできません。あなたの名前やメールアドレスは表示しません）。共有はリストの画面からいつでも停止できます。
      </p>
      <h2 className="mt-4 font-bold">メール</h2>
      <p>登録時の確認メールは、運営チームの Gmail アカウントから送ります。登録の確認以外の目的でメールを送ることはありません。</p>
      <h2 className="mt-4 font-bold">外部サービス</h2>
      <p>
        地図の表示（OpenFreeMap）、場所の検索（OpenStreetMap Nominatim）、移動時間の計算（Google Routes
        API）に、スポットの位置情報を送ります。ユーザーを特定できる情報は送りません。
      </p>
      <p className="mt-2">
        経路作成の「AIと相談」を使うと、入力した会話の文章・リスト内のスポット名・日付や時間などの条件を、AIの外部サービス（Google
        Gemini API）に送ります。ユーザー名やメールアドレスは送りません。会話の内容は保存しません。外部サービスの無料枠では、送った内容がサービス改善に使われる場合があるため、個人を特定できる情報は入力しないでください。
      </p>
      <h2 className="mt-4 font-bold">初期データの写真</h2>
      <p>
        初期データのスポットの写真は Wikimedia Commons のクリエイティブ・コモンズ等の画像です。作者とライセンスは各写真の下と
        <a href="/credits" className="underline">
          写真とデータのクレジット
        </a>
        に記載しています。
      </p>
      <h2 className="mt-4 font-bold">退会</h2>
      <p>マイページから退会すると、投稿・写真・いいね・リスト・経路プランをすべて削除します。</p>
    </div>
  );
}
