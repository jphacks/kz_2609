"use client";

import { Save, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PostFields } from "@/components/post-fields";
import { Button, Notice, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import { COMMENT_MAX, type Category, type StayDuration } from "@/lib/constants";

type Post = {
  id: string;
  spotId: string;
  spotName: string;
  comment: string;
  category: Category;
  stayDuration: StayDuration | null;
  images: { id: string; thumbUrl: string | null }[];
};

// S-05 投稿編集（F-2-12：コメント・カテゴリ・滞在時間の編集と削除。写真と場所は変えられない）
export function PostEdit() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api<Post>(`/posts/${postId}`)
      .then(setPost)
      .catch((e) => setError(errorMessage(e)));
  }, [postId]);

  if (!post) {
    return (
      <div className="mx-auto w-full max-w-xl px-4">
        <PageHeader title="投稿の編集" backHref="/me" />
        {error ? <Notice tone="error">{error}</Notice> : <Spinner />}
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api(`/posts/${post.id}`, {
        method: "PATCH",
        json: { comment: post.comment, category: post.category, stayDuration: post.stayDuration },
      });
      router.push(`/spots/${post.spotId}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("この投稿を削除しますか。写真も削除され、元に戻せません。")) return;
    setDeleting(true);
    try {
      await api(`/posts/${post.id}`, { method: "DELETE" });
      router.push("/me");
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-8">
      <PageHeader title="投稿の編集" backHref="/me" />
      <p className="mb-3 text-sm text-muted">{post.spotName}</p>
      {post.images.length > 0 && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {post.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.thumbUrl ?? ""} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          ))}
        </div>
      )}
      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}
      <PostFields
        comment={post.comment}
        category={post.category}
        stay={post.stayDuration}
        onChange={(v) =>
          setPost({
            ...post,
            ...(v.comment !== undefined && { comment: v.comment }),
            ...(v.category !== undefined && { category: v.category }),
            ...(v.stay !== undefined && { stayDuration: v.stay }),
          })
        }
      />
      <div className="mt-6 flex flex-col gap-2">
        <Button icon={Save} onClick={save} loading={saving} disabled={post.comment.length > COMMENT_MAX}>
          保存する
        </Button>
        <Button variant="danger" icon={Trash2} onClick={remove} loading={deleting}>
          この投稿を削除
        </Button>
      </div>
    </div>
  );
}
