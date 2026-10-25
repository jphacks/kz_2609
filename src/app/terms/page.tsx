import { PageHeader } from "@/components/ui";

// S-16 利用規約（JPHACKS デモ用の仮の文面。正式リリース前に見直す）
export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 text-sm leading-7">
      <PageHeader title="利用規約" backHref="/" />
      <p>
        本サービス「TravelSeek」（以下「本サービス」）は、旅行先のスポットを写真で共有し、回り方を計画するためのサービスです。
      </p>
      <h2 className="mt-4 font-bold">投稿について</h2>
      <ul className="list-disc pl-5">
        <li>投稿できる写真は、ご自身で撮影したものに限ります。</li>
        <li>他人が特定できる写真や、私有地など公開に適さない場所の投稿はしないでください。</li>
        <li>投稿された写真・コメントは、本サービスの中で他のユーザーに公開されます。</li>
      </ul>
      <h2 className="mt-4 font-bold">経路・移動時間について</h2>
      <p>
        経路案の所要時間は Google マップの情報をもとにした計画用の値です。当日は「ナビ開始」から Google
        マップで最新の経路を確認してください。
      </p>
      <h2 className="mt-4 font-bold">サービスの提供</h2>
      <p>本サービスは無料の外部サービスを利用しており、利用状況によって一部の機能を一時的に停止することがあります。</p>
    </div>
  );
}
