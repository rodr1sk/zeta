package br.com.zeta;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class ZetaApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZetaApplication.class, args);
    }

    // Permite que o front (Live Server, porta 5500) chame a API
    @Bean
    WebMvcConfigurer cors() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry r) {
                r.addMapping("/api/**").allowedOrigins("*").allowedMethods("*");
            }
        };
    }
}