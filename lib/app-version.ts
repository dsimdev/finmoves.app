// Marca si la versión ACTUAL exige que los clientes viejos se actualicen sí o sí.
//
// Por defecto `false`: la app se auto-actualiza sola en el próximo arranque en frío
// (sin molestar). La mayoría de los releases (tweaks de UI, etc.) van así.
//
// Poné `true` SOLO en un release con cambios incompatibles hacia atrás (esquema de
// Firestore, contrato de API, fix crítico que no debe correr con el cliente viejo):
// los clientes viejos verán el banner "Actualizar" persistente. Volvé a `false`
// en el siguiente release normal.
export const REQUIRE_UPDATE = false;
