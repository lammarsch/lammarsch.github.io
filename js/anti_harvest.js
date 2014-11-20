function doPerson(part1, part2, part3) {
 var a, b, c, d, e;
 a = '<a href=\"mai';
 b = part1;
 c = '\" class=\"mail\">';
 a += 'lto:';
 b += '@';
 e = '<\/a>';
 d = part2;
 b += part3;
 d = part1 + "(at)" + part3;
 document.write(a+b+c+d+e);
}