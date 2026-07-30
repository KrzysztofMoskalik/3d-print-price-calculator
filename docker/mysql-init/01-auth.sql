ALTER USER 'calculator'@'%' IDENTIFIED WITH mysql_native_password BY 'calculator';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'root';
FLUSH PRIVILEGES;
