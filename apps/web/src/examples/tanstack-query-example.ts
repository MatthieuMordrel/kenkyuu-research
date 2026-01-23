import { queryOptions, useQuery } from "@tanstack/react-query";

// Types
interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

interface Comment {
  postId: number;
  id: number;
  name: string;
  email: string;
  body: string;
}

// Query Key Factory (hierarchical structure)
const postKeys = {
  all: ["posts"] as const,
  lists: () => [...postKeys.all, "list"] as const,
  list: (userId?: number) => [...postKeys.lists(), { userId }] as const,
  details: () => [...postKeys.all, "detail"] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
  comments: (postId: number) => [...postKeys.detail(postId), "comments"] as const,
};

// Query Functions (private - not exported)
const fetchPosts = async (userId?: number): Promise<Post[]> => {
  const url = userId
    ? `https://jsonplaceholder.typicode.com/posts?userId=${userId}`
    : "https://jsonplaceholder.typicode.com/posts";
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch posts");
  return response.json();
};

const fetchPost = async (id: number): Promise<Post> => {
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${id}`
  );
  if (!response.ok) throw new Error("Failed to fetch post");
  return response.json();
};

const fetchComments = async (postId: number): Promise<Comment[]> => {
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${postId}/comments`
  );
  if (!response.ok) throw new Error("Failed to fetch comments");
  return response.json();
};

// Query Options (for type-safe imperative access)
export const postsOptions = (userId?: number) =>
  queryOptions({
    queryKey: postKeys.list(userId),
    queryFn: () => fetchPosts(userId),
    staleTime: 30_000, // Fresh for 30 seconds
  });

export const postOptions = (id: number) =>
  queryOptions({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
    staleTime: 60_000, // Fresh for 1 minute
  });

export const commentsOptions = (postId: number) =>
  queryOptions({
    queryKey: postKeys.comments(postId),
    queryFn: () => fetchComments(postId),
    staleTime: 60_000,
  });

// Custom Hooks (public API - only export these)
export const usePosts = (userId?: number) => {
  return useQuery(postsOptions(userId));
};

export const usePost = (id: number) => {
  return useQuery(postOptions(id));
};

export const useComments = (postId: number) => {
  return useQuery(commentsOptions(postId));
};

// Atomic selector hooks for fine-grained subscriptions
export const usePostsCount = (userId?: number) => {
  return useQuery({
    ...postsOptions(userId),
    select: (data) => data.length,
  });
};

export const usePostTitles = (userId?: number) => {
  return useQuery({
    ...postsOptions(userId),
    select: (data) => data.map((post) => ({ id: post.id, title: post.title })),
  });
};

export const useCommentsCount = (postId: number) => {
  return useQuery({
    ...commentsOptions(postId),
    select: (data) => data.length,
  });
};
