# Формы персонажа

Внешность определяется постоянной мощью: `power({...state, fightPrep: null})`.
Зал, количество побед и тренировок не определяют изображение. Временная подготовка
к бою не меняет телосложение. При уменьшении постоянной мощи форма также уменьшается;
поп-ап «Ты стал сильнее» появляется только при переходе на более высокую форму.

| Форма | Мощь от | Файл в `dist/assets/` | Изображение |
|---|---:|---|---|
| 1 | 9 | hero-01.jpg | Исходное |
| 2 | 12 | hero-02.jpg | 1/3 между hero-01 и hero-04 |
| 3 | 16 | hero-03.jpg | 2/3 между hero-01 и hero-04 |
| 4 | 20 | hero-04.jpg | Исходное |
| 5 | 25 | hero-05.jpg | 1/4 между hero-04 и hero-08 |
| 6 | 31 | hero-06.jpg | 1/2 между hero-04 и hero-08 |
| 7 | 38 | hero-07.jpg | hero-08 с уменьшенной мускулатурой |
| 8 | 45 | hero-08.jpg | Исходное |
| 9 | 53 | hero-09.jpg | 1/4 между hero-08 и hero-12 |
| 10 | 61 | hero-10.jpg | hero-12 с уменьшенной мускулатурой |
| 11 | 71 | hero-11.jpg | hero-12 с немного уменьшенной мускулатурой |
| 12 | 84 | hero-12.jpg | Исходное |

При пересечении нескольких порогов одним действием показывается одно сравнение
исходной и конечной формы. Если действие также вызывает случайное событие,
сначала показывается событие, затем сравнение форм. Загрузка сохранения не повторяет
поп-ап; форма вычисляется из сохранённых характеристик. Новая игра возвращает форму 1.

## Генерация изображений

Использован встроенный `image_gen` в режиме редактирования с исходными изображениями
как референсами. Новые файлы — JPEG 1024 × 1536, качество 85; исходные четыре сохранены.
Между первым и вторым исходными изображениями добавлены две формы, между остальными —
по три, чтобы в сумме получить 12.

Общий промпт для промежуточных форм (доля и описание мускулатуры меняются по таблице):

```text
Use case: identity-preserve. Asset type: ONE full-body portrait for Gym Boss
character evolution. Input image 1 is the LOWER muscle-mass endpoint; image 2
is the UPPER endpoint. Generate exactly ONE intermediate form at the specified
fraction of muscular development from image 1 to image 2.
Preserve the SAME adult man's recognizable face, short brown hair, stubble,
expression, skin color, height, neutral front-facing standing pose with arms
relaxed at sides, dark charcoal shorts and black trainers. Match the existing
photorealistic game art. Keep the entire body including head and shoes visible
with the same vertical 2:3 portrait framing and subject centered, head near y=11%
and feet near y=87%, same camera distance. Preserve image 1's dark industrial
gym background, warm amber light from left and cool blue light from right.
Change ONLY muscle development proportionally in all muscle groups, maintaining
a lean waist. No props added, no writing, no collage, no extra people.
MUST be visually between the two supplied endpoints, not a copy of either.
```

Для форм 7, 10 и 11 использован уточняющий промпт с одним верхним референсом:

```text
Use case: identity-preserve. Edit target: supplied full-body Gym Boss portrait.
Create ONE smaller intermediate version of this SAME adult man. Change ONLY
his muscle mass: REDUCE shoulder and torso WIDTH by the specified percentage;
REDUCE muscle circumference and volume in chest, deltoids, biceps, triceps,
traps, thighs and calves by the specified percentage. The result must be
visibly slimmer in those muscles than this endpoint reference, but still
a heavily muscled bodybuilder. KEEP identical FACE, stubble, short hair,
height, pose, head scale, camera scale, dark gray shorts, black shoes,
industrial gym background, amber left light and blue right light.
Entire body head to feet visible in same 2:3 portrait framing. Do not turn him
into a slim athlete: preserve large muscular physique and just make the
requested proportional step DOWN in body size. No text, no collage, no added props.
```

Параметры уточнения: форма 7 — hero-08, ширина −9%, объём −18%; форма 10 — hero-12,
ширина −14%, объём −28%; форма 11 — hero-12, ширина −7%, объём −14%.
