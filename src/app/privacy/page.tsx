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
      </ul>
      <h2 className="mt-4 font-bold">メール</h2>
      <p>登録時の確認メールは、運営チームの Gmail アカウントから送ります。登録の確認以外の目的でメールを送ることはありません。</p>
      <h2 className="mt-4 font-bold">外部サービス</h2>
      <p>
        地図の表示（OpenFreeMap）、場所の検索（OpenStreetMap Nominatim）、移動時間の計算（Google Routes
        API）に、スポットの位置情報を送ります。ユーザーを特定できる情報は送りません。
      </p>
      <h2 className="mt-4 font-bold">退会</h2>
      <p>マイページから退会すると、投稿・写真・いいね・リスト・経路プランをすべて削除します。</p>
    </div>
  );
}
