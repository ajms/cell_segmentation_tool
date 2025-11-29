import { useState, useEffect } from 'react';
import { fetchImages, getImageUrl } from '../utils/api';

export function ImageList({ selectedId, onSelect, annotationCounts = {} }) {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchImages();
        setImages(data);
      } catch (err) {
        setError(err.message || 'Failed to load images');
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, []);

  const filteredImages = images.filter((img) =>
    img.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const labeledCount = Object.values(annotationCounts).filter((c) => c > 0).length;
  const totalCount = images.length;

  if (isLoading) {
    return (
      <div className="image-list">
        <div className="image-list-header">
          <h2>Images</h2>
        </div>
        <div className="image-list-loading">
          <div className="loading-spinner" />
          <span>Loading images...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="image-list">
        <div className="image-list-header">
          <h2>Images</h2>
        </div>
        <div className="image-list-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="image-list">
      <div className="image-list-header">
        <h2>Images</h2>
        <div className="progress-indicator">
          <span className="progress-text">{labeledCount} / {totalCount}</span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(labeledCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="image-list-search">
        <input
          type="text"
          placeholder="Search images..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      <div className="image-list-items">
        {filteredImages.map((image) => {
          const count = annotationCounts[image.id] || 0;
          const isSelected = image.id === selectedId;

          return (
            <div
              key={image.id}
              className={`image-list-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(image.id)}
            >
              <div className="image-thumbnail">
                <img
                  src={getImageUrl(image.id)}
                  alt={image.filename}
                  loading="lazy"
                />
                {count > 0 && (
                  <div className="annotation-badge">{count}</div>
                )}
              </div>
              <div className="image-info">
                <span className="image-name">{image.filename}</span>
                <span className="image-dims">
                  {image.width} x {image.height}
                </span>
              </div>
            </div>
          );
        })}

        {filteredImages.length === 0 && (
          <div className="image-list-empty">
            <span>No images found</span>
          </div>
        )}
      </div>
    </div>
  );
}
