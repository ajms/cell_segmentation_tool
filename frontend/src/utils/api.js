import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Image endpoints
export const fetchImages = () => api.get('/images').then((res) => res.data);

export const getImageUrl = (imageId) => `/api/images/${imageId}`;

export const fetchImageInfo = (imageId) =>
  api.get(`/images/${imageId}/info`).then((res) => res.data);

// SAM endpoints
export const encodeImage = (imageId) =>
  api.post(`/sam/encode/${imageId}`).then((res) => res.data);

export const segmentImage = (imageId, points) =>
  api.post('/sam/segment', { image_id: imageId, points }).then((res) => res.data);

// Annotation endpoints
export const fetchAnnotations = (imageId) =>
  api.get(`/annotations/${imageId}`).then((res) => res.data);

export const createAnnotation = (imageId, data) =>
  api.post(`/annotations/${imageId}`, data).then((res) => res.data);

export const updateAnnotation = (annotationId, data) =>
  api.put(`/annotations/${annotationId}`, data).then((res) => res.data);

export const deleteAnnotation = (annotationId) =>
  api.delete(`/annotations/${annotationId}`);

export default api;
