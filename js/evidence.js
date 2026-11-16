// Each rule the app applies and the paper behind it. Mirrors docs/EVIDENCE.md.
// "caveat" states honestly where the paper does not fully cover a novice.

export const EVIDENCE = [
  {
    rule: 'Cada músculo se entrena al menos 2 veces por semana',
    source: 'Schoenfeld, Ogborn y Krieger (2016). Sports Medicine, 46(11), 1689-1697.',
    doi: '10.1007/s40279-016-0543-8',
    caveat: 'Si 3 veces es mejor que 2 sigue sin resolverse.',
  },
  {
    rule: 'Más series por semana dan más músculo; la meta es llegar a unas 10 por músculo grande',
    source: 'Schoenfeld, Ogborn y Krieger (2017). Journal of Sports Sciences, 35(11), 1073-1082.',
    doi: '10.1080/02640414.2016.1210197',
    caveat: 'La relación gradual es clara; el corte exacto en 10 series es solo una tendencia (p = 0.074).',
  },
  {
    rule: 'Cualquier rango de 6 a 15 repeticiones sirve para ganar músculo',
    source: 'Schoenfeld, Grgic, Ogborn y Krieger (2017). Journal of Strength and Conditioning Research, 31(12), 3508-3523.',
    doi: '10.1519/jsc.0000000000002200',
    caveat: 'Los estudios llevaban las series al fallo. Las cargas pesadas dan más fuerza máxima.',
  },
  {
    rule: 'No hace falta llegar al fallo: se dejan 2 o 3 repeticiones en reserva',
    source: 'Grgic, Schoenfeld, Orazem y Sabol (2022). Journal of Sport and Health Science, 11(2), 202-211.',
    doi: '10.1016/j.jshs.2021.01.007',
    caveat: 'El estudio dice que el fallo no es necesario; la cifra de 2 o 3 en reserva es una regla práctica.',
  },
  {
    rule: 'Descansos largos (3 min) en los ejercicios grandes',
    source: 'Schoenfeld, Pope, Benik, Hester y cols. (2016). Journal of Strength and Conditioning Research, 30(7), 1805-1812.',
    doi: '10.1519/jsc.0000000000001272',
    caveat: 'Hecho con hombres jóvenes ya entrenados, comparando 3 min contra 1 min.',
  },
  {
    rule: 'Progresión doble: primero repeticiones, luego peso',
    source: 'American College of Sports Medicine (2009). Medicine & Science in Sports & Exercise, 41(3), 687-708.',
    doi: '10.1249/mss.0b013e3181915670',
    caveat: 'Documento de posición. Bajar un 10 % tras tres sesiones estancadas es una regla práctica, sin paper propio.',
  },
  {
    rule: 'Proteína de 1.6 a 2.2 g por kg de peso',
    source: 'Morton, Murphy, McKellar, Schoenfeld y cols. (2018). British Journal of Sports Medicine, 52(6), 376-384.',
    doi: '10.1136/bjsports-2017-097608',
    caveat: 'El resumen fija 1.6 g por kg como punto donde deja de sumar. El techo de 2.2 viene del texto completo y está pendiente de comprobar.',
  },
  {
    rule: 'Bajar despacio: cerca de 0.5 % del peso por semana',
    source: 'Garthe, Raastad, Refsnes, Koivisto y cols. (2011). International Journal of Sport Nutrition and Exercise Metabolism, 21(2), 97-104.',
    doi: '10.1123/ijsnem.21.2.97',
    caveat: 'Hecho con atletas de élite: bajando 0.7 % por semana ganaron masa magra; bajando 1 % no.',
  },
  {
    rule: 'El déficit no pasa de 500 kcal al día',
    source: 'Murphy y Koehler (2022). Scandinavian Journal of Medicine & Science in Sports, 32(1), 125-137.',
    doi: '10.1111/sms.14075',
    caveat: 'Un déficit de energía frena la ganancia de masa magra, pero no la de fuerza.',
  },
  {
    rule: 'Se puede perder grasa y ganar músculo a la vez',
    source: 'Barakat, Pearson, Escalante, Campbell y cols. (2020). Strength & Conditioning Journal, 42(5), 7-21.',
    doi: '10.1519/ssc.0000000000000584',
    caveat: 'Revisión narrativa. Referencia confirmada en el registro, pero su resumen no se pudo leer en una base abierta.',
  },
  {
    rule: 'Gasto en reposo con la fórmula de Mifflin St Jeor',
    source: 'Mifflin, St Jeor, Hill, Scott y cols. (1990). The American Journal of Clinical Nutrition, 51(2), 241-247.',
    doi: '10.1093/ajcn/51.2.241',
    caveat: 'Los multiplicadores de actividad son una convención, no salen de este paper.',
  },
];
