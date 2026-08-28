import React from 'react';

const Badge = ({ status, text }) => {
  const displayStatus = status || 'WAITING';
  const displayText = text || displayStatus.replace('_', ' ');

  return (
    <span className={`badge badge-${displayStatus}`}>
      {displayText}
    </span>
  );
};

export default Badge;
