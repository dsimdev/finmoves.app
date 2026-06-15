// OVERRIDE manual del banner de actualización.
//
// Por defecto el banner se decide solo por semver: aparece en releases MINOR/MAJOR
// (cambios relevantes) y NO en patches (se actualizan solos en el próximo arranque
// en frío). Ver `esMinorOMajor` en hooks/useUpdateBanner.
//
// Poné `true` SOLO para forzar el banner en un PATCH crítico (cambio incompatible
// hacia atrás: esquema de Firestore, contrato de API, fix que no debe correr con el
// cliente viejo). Volvé a `false` en el siguiente release.
export const REQUIRE_UPDATE = false;
