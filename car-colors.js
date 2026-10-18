// Original arcade CAR NUMBER order. Tones remain legible on the light lobby UI.
export const CAR_COLORS=Object.freeze([
 {name:'Red',color:'#d52247'}, {name:'Blue',color:'#0874db'},
 {name:'Yellow',color:'#c7a600'}, {name:'Green',color:'#17864a'},
 {name:'Black',color:'#34333c'}, {name:'Pink',color:'#d2549f'},
 {name:'Light blue',color:'#279fbe'}, {name:'Orange',color:'#e07714'}
]);
export const carColor=cabinet=>CAR_COLORS[cabinet-1]||{name:'Unknown',color:'#77776c'};
