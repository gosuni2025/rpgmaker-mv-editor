import React from 'react';

export interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  spritesetRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  regionMeshesRef: React.MutableRefObject<any[]>;
  startPosMeshesRef: React.MutableRefObject<any[]>;
  testStartPosMeshesRef: React.MutableRefObject<any[]>;
  vehicleStartPosMeshesRef: React.MutableRefObject<any[]>;
  eventOverlayMeshesRef: React.MutableRefObject<any[]>;
  dragPreviewMeshesRef: React.MutableRefObject<any[]>;
  lightOverlayMeshesRef: React.MutableRefObject<any[]>;
}
