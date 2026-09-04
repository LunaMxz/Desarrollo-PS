Aqui va la logica de negocio: validaciones de reglas del caso de uso
(ej. "no se puede dar de alta un residente si la unidad ya tiene uno activo").

Un service llama a repositories/ para leer o escribir en la base de datos,
pero nunca escribe SQL directamente.
