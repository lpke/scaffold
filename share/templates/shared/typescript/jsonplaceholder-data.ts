/**
 * JSONPlaceholder guide:
 *
 * Base URL: https://jsonplaceholder.typicode.com
 * Resources: /posts, /comments, /albums, /photos, /todos, /users.
 * Read: GET /resource or /resource/:id.
 * Write: POST /resource, PUT/PATCH/DELETE /resource/:id. Writes are faked, not persisted.
 * Filter: add query params, e.g. /posts?userId=1 or /comments?postId=1.
 * Nested: /posts/:id/comments, /albums/:id/photos, /users/:id/albums, /users/:id/todos, /users/:id/posts.
 */

/**
 * JSONPlaceholder user from GET /users and GET /users/:id.
 * Related nested reads: GET /users/:id/albums, /users/:id/todos, /users/:id/posts.
 * Supports fake POST /users, PUT/PATCH/DELETE /users/:id.
 */
export type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    };
  };
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
    bs: string;
  };
};

/**
 * JSONPlaceholder todo from GET /todos and GET /todos/:id.
 * Filter with GET /todos?userId=:userId or use nested GET /users/:id/todos.
 * Supports fake POST /todos, PUT/PATCH/DELETE /todos/:id.
 */
export type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

/**
 * JSONPlaceholder photo from GET /photos and GET /photos/:id.
 * Filter with GET /photos?albumId=:albumId or use nested GET /albums/:id/photos.
 * Supports fake POST /photos, PUT/PATCH/DELETE /photos/:id.
 */
export type Photo = {
  albumId: number;
  id: number;
  title: string;
  url: string;
  thumbnailUrl: string;
};

/**
 * JSONPlaceholder album from GET /albums and GET /albums/:id.
 * Filter with GET /albums?userId=:userId or use nested GET /users/:id/albums.
 * Supports fake POST /albums, PUT/PATCH/DELETE /albums/:id.
 */
export type Album = {
  userId: number;
  id: number;
  title: string;
};

/**
 * JSONPlaceholder comment from GET /comments and GET /comments/:id.
 * Filter with GET /comments?postId=:postId or use nested GET /posts/:id/comments.
 * Supports fake POST /comments, PUT/PATCH/DELETE /comments/:id.
 */
export type Comment = {
  postId: number;
  id: number;
  name: string;
  email: string;
  body: string;
};

/**
 * JSONPlaceholder post from GET /posts and GET /posts/:id.
 * Filter with GET /posts?userId=:userId or use nested GET /users/:id/posts.
 * Supports fake POST /posts, PUT/PATCH/DELETE /posts/:id.
 */
export type Post = {
  userId: number;
  id: number;
  title: string;
  body: string;
};
