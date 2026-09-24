import React from 'react';
import LiveRouteMap from './LiveRouteMap';

/**
 * RouteMap Compatibility Layer
 * Preserves backwards compatibility for existing imports by forwarding to LiveRouteMap.
 */
export default function RouteMap(props) {
  return <LiveRouteMap {...props} />;
}
